import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore'
import { firebaseAuth, firebaseConfigured, firestore } from './firebase'
import type { UsageEvent, UsageKind, UserStat } from './admin-metrics'

// Registo de utilização para o painel de administração. Nada daqui guarda dados de clientes: só contagens e tokens.
// As regras do Firestore deixam cada conta escrever os seus próprios registos e só os administradores lê-los.

const maxEvents = 5000

type AiUsage = { kind: UsageKind; model: string; inputTokens: number; outputTokens: number; ok: boolean }

const tokens = (value: number) => Math.max(0, Math.min(Math.round(Number.isFinite(value) ? value : 0), 5_000_000))

// Nunca falha nem atrasa o pedido à IA: se não for possível registar, o registo perde-se.
export function recordAiUsage(entry: AiUsage) {
  if (!firebaseConfigured) return
  const uid = firebaseAuth().currentUser?.uid
  if (!uid) return
  void addDoc(collection(firestore(), 'usage'), {
    uid,
    kind: entry.kind,
    model: entry.model.slice(0, 60),
    inputTokens: tokens(entry.inputTokens),
    outputTokens: tokens(entry.outputTokens),
    ok: entry.ok,
    at: serverTimestamp(),
  }).catch(() => undefined)
}

function countOf(key: string) {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

// Ficha da conta (quem é, quanto tem e quando usou a app) para o administrador ver sem aceder aos dados dos clientes.
export function publishStats(account: { uid: string; email: string; name: string }) {
  if (!firebaseConfigured) return Promise.resolve()
  return setDoc(doc(firestore(), 'stats', account.uid), {
    email: account.email.slice(0, 120),
    name: account.name.slice(0, 120),
    clients: countOf('casanexa-history'),
    properties: countOf('casanexa-properties'),
    appointments: countOf('casanexa-appointments'),
    lastSeenAt: serverTimestamp(),
  }, { merge: true }).catch(() => undefined)
}

type AdminData = { events: UsageEvent[]; stats: UserStat[]; truncated: boolean }

const asDate = (value: unknown) => value instanceof Timestamp ? value.toDate() : null
const asNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0
const kinds: UsageKind[] = ['report', 'listing', 'market']

export async function loadAdminData(days: number): Promise<AdminData> {
  const db = firestore()
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - (days - 1))

  const [usage, stats] = await Promise.all([
    getDocs(query(collection(db, 'usage'), where('at', '>=', Timestamp.fromDate(since)), orderBy('at', 'desc'), limit(maxEvents))),
    getDocs(collection(db, 'stats')),
  ])

  const events: UsageEvent[] = []
  usage.forEach((item) => {
    const data = item.data()
    const at = asDate(data.at)
    if (!at || typeof data.uid !== 'string' || !kinds.includes(data.kind)) return
    events.push({ uid: data.uid, kind: data.kind, model: String(data.model ?? ''), inputTokens: asNumber(data.inputTokens), outputTokens: asNumber(data.outputTokens), ok: data.ok !== false, at })
  })

  const users: UserStat[] = []
  stats.forEach((item) => {
    const data = item.data()
    users.push({
      uid: item.id,
      email: String(data.email ?? ''),
      name: String(data.name ?? ''),
      clients: asNumber(data.clients),
      properties: asNumber(data.properties),
      appointments: asNumber(data.appointments),
      lastSeenAt: asDate(data.lastSeenAt),
    })
  })

  return { events, stats: users, truncated: usage.size >= maxEvents }
}
