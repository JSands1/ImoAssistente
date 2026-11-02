// Agregação das métricas de utilização e do custo estimado da IA, para o painel de administração. Sem dependências do Firebase.

export type UsageKind = 'report' | 'listing' | 'market'

export type UsageEvent = {
  uid: string
  kind: UsageKind
  model: string
  inputTokens: number
  outputTokens: number
  ok: boolean
  at: Date
}

export type UserStat = {
  uid: string
  email: string
  name: string
  clients: number
  properties: number
  appointments: number
  lastSeenAt: Date | null
}

// Preços em dólares por milhão de tokens e taxa de câmbio para euros. São estimativas editáveis, não a fatura.
export type Pricing = { inputPerM: number; outputPerM: number; eurPerUsd: number }

export const defaultPricing: Pricing = { inputPerM: 0.75, outputPerM: 3.75, eurPerUsd: 0.92 }

export const kindLabels: Record<UsageKind, string> = {
  report: 'Análise do imóvel',
  listing: 'Descritivo do anúncio',
  market: 'Preços da zona (web)',
}

export function eventCostEur(event: Pick<UsageEvent, 'inputTokens' | 'outputTokens'>, pricing: Pricing) {
  return ((event.inputTokens * pricing.inputPerM + event.outputTokens * pricing.outputPerM) / 1_000_000) * pricing.eurPerUsd
}

export function dayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export type UserRow = UserStat & { calls: number; failed: number; inputTokens: number; outputTokens: number; costEur: number }

export type AdminSummary = {
  days: number
  calls: number
  failed: number
  inputTokens: number
  outputTokens: number
  costEur: number
  projectedMonthEur: number
  activeUsers: number
  totalUsers: number
  totalClients: number
  totalProperties: number
  totalAppointments: number
  costPerActiveUserEur: number
  byDay: Array<{ day: string; calls: number; costEur: number }>
  byKind: Array<{ kind: UsageKind; calls: number; costEur: number }>
  byUser: UserRow[]
}

// `days` dias terminados em `now` (inclui o dia de hoje). Eventos fora desse intervalo são ignorados.
export function summarize(events: UsageEvent[], stats: UserStat[], pricing: Pricing, now: Date, days: number): AdminSummary {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
  const inRange = events.filter((event) => event.at >= start && event.at <= now)

  const byDayMap = new Map<string, { calls: number; costEur: number }>()
  for (let offset = 0; offset < days; offset += 1) {
    byDayMap.set(dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset)), { calls: 0, costEur: 0 })
  }

  const kinds = new Map<UsageKind, { calls: number; costEur: number }>()
  const users = new Map<string, UserRow>()
  for (const stat of stats) users.set(stat.uid, { ...stat, calls: 0, failed: 0, inputTokens: 0, outputTokens: 0, costEur: 0 })

  let calls = 0
  let failed = 0
  let inputTokens = 0
  let outputTokens = 0
  let costEur = 0

  for (const event of inRange) {
    const cost = eventCostEur(event, pricing)
    calls += 1
    if (!event.ok) failed += 1
    inputTokens += event.inputTokens
    outputTokens += event.outputTokens
    costEur += cost

    const day = byDayMap.get(dayKey(event.at))
    if (day) {
      day.calls += 1
      day.costEur += cost
    }
    const kind = kinds.get(event.kind) ?? { calls: 0, costEur: 0 }
    kind.calls += 1
    kind.costEur += cost
    kinds.set(event.kind, kind)

    const user = users.get(event.uid) ?? { uid: event.uid, email: '', name: '', clients: 0, properties: 0, appointments: 0, lastSeenAt: null, calls: 0, failed: 0, inputTokens: 0, outputTokens: 0, costEur: 0 }
    user.calls += 1
    if (!event.ok) user.failed += 1
    user.inputTokens += event.inputTokens
    user.outputTokens += event.outputTokens
    user.costEur += cost
    users.set(event.uid, user)
  }

  const byUser = [...users.values()].sort((a, b) => b.costEur - a.costEur || b.calls - a.calls || a.email.localeCompare(b.email))
  const activeUsers = new Set([
    ...inRange.map((event) => event.uid),
    ...stats.filter((stat) => stat.lastSeenAt && stat.lastSeenAt >= start).map((stat) => stat.uid),
  ]).size

  return {
    days,
    calls,
    failed,
    inputTokens,
    outputTokens,
    costEur,
    projectedMonthEur: (costEur / days) * 30,
    activeUsers,
    totalUsers: users.size,
    totalClients: stats.reduce((sum, stat) => sum + stat.clients, 0),
    totalProperties: stats.reduce((sum, stat) => sum + stat.properties, 0),
    totalAppointments: stats.reduce((sum, stat) => sum + stat.appointments, 0),
    costPerActiveUserEur: activeUsers ? costEur / activeUsers : 0,
    byDay: [...byDayMap].map(([day, value]) => ({ day, ...value })),
    byKind: [...kinds].map(([kind, value]) => ({ kind, ...value })).sort((a, b) => b.costEur - a.costEur),
    byUser,
  }
}
