import { z } from 'zod'
import { formatEur } from './market-stats'
import { districts, featureOptions } from './portal-links'

// ---------- Opções ----------

export const statusOptions = [
  { value: 'procura', label: 'Em procura' },
  { value: 'comprou', label: 'Comprou' },
  { value: 'desistiu', label: 'Desistiu' },
] as const

export const houseTypeOptions = [
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'moradia', label: 'Moradia' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'outro', label: 'Outro' },
] as const

export const interestOptions = [
  { value: '', label: 'Sem opinião' },
  { value: 'gostou', label: 'Gostou' },
  { value: 'talvez', label: 'Talvez' },
  { value: 'nao', label: 'Não gostou' },
] as const

export const clientTypeOptions = [
  { value: 'comprador', label: 'Comprador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'investidor', label: 'Investidor' },
  { value: 'comprador-vendedor', label: 'Compra e vende' },
] as const

export const priorityOptions = [
  { value: '', label: 'Sem prioridade' },
  { value: 'quente', label: 'Quente (decide em breve)' },
  { value: 'morno', label: 'Morno' },
  { value: 'frio', label: 'Frio' },
] as const

export const timeframeOptions = [
  { value: '', label: 'Sem prazo definido' },
  { value: 'imediato', label: 'Imediato' },
  { value: '1-3-meses', label: '1 a 3 meses' },
  { value: '3-6-meses', label: '3 a 6 meses' },
  { value: 'mais-6-meses', label: 'Mais de 6 meses' },
] as const

export const financingOptions = [
  { value: '', label: 'Por saber' },
  { value: 'dinheiro', label: 'Pagamento a pronto' },
  { value: 'credito-aprovado', label: 'Crédito aprovado' },
  { value: 'credito-em-processo', label: 'Crédito em processo' },
  { value: 'credito-por-pedir', label: 'Crédito por pedir' },
] as const

export const sourceOptions = [
  { value: '', label: 'Não indicada' },
  { value: 'idealista', label: 'Idealista' },
  { value: 'imovirtual', label: 'Imovirtual' },
  { value: 'casa-sapo', label: 'Casa Sapo' },
  { value: 'site', label: 'Site' },
  { value: 'redes-sociais', label: 'Redes sociais' },
  { value: 'recomendacao', label: 'Recomendação' },
  { value: 'outro', label: 'Outra' },
] as const

export const historyTypologies = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6+'] as const

const statusLabel = Object.fromEntries(statusOptions.map((option) => [option.value, option.label])) as Record<string, string>
const houseTypeLabel = Object.fromEntries(houseTypeOptions.map((option) => [option.value, option.label])) as Record<string, string>

// ---------- Modelo (tolerante: um registo ou campo inválido nunca faz perder os restantes) ----------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).catch('')
const optionalPositive = z.number().positive().nullable().catch(null)

function listOf<S extends z.ZodType>(schema: S) {
  return z.array(z.unknown()).catch([]).transform((items) => items.flatMap((item) => {
    const parsed = schema.safeParse(item)
    return parsed.success ? [parsed.data as z.output<S>] : []
  }))
}

const visitSchema = z.object({
  id: z.string(),
  date: isoDate,
  property: z.string().catch(''),
  url: z.string().catch(''),
  interest: z.enum(['', 'gostou', 'talvez', 'nao']).catch(''),
  notes: z.string().catch(''),
})

const purchaseSchema = z.object({
  date: isoDate,
  propertyType: z.enum(['apartamento', 'moradia', 'terreno', 'comercial', 'outro']).catch('apartamento'),
  typology: z.string().catch(''),
  location: z.string().catch(''),
  priceEur: optionalPositive,
  areaM2: optionalPositive,
  description: z.string().catch(''),
})

const featureValues: string[] = featureOptions.map((option) => option.value)
const optionValues = <T extends readonly { value: string }[]>(options: T) => options.map((option) => option.value) as [T[number]['value'], ...T[number]['value'][]]

// O que o cliente procura e como o classificamos (usado na carteira de clientes).
const wantKinds = ['apartamento', 'moradia', 'terreno', 'comercial', 'outro'] as const
export type WantKind = (typeof wantKinds)[number]

// Fichas antigas guardavam um só tipo (`propertyType`); passam a lista `propertyTypes`.
function migrateWants(input: unknown) {
  if (typeof input !== 'object' || input === null) return input
  const raw = input as Record<string, unknown>
  const next = { ...raw }
  if (!('propertyTypes' in next) && 'propertyType' in next) {
    next.propertyTypes = typeof next.propertyType === 'string' && next.propertyType ? [next.propertyType] : []
  }
  if (!('typologies' in next) && 'typology' in next) {
    next.typologies = typeof next.typology === 'string' && next.typology ? [next.typology] : []
  }
  delete next.propertyType
  delete next.typology
  return next
}

const wantsObject = z.object({
  clientType: z.enum(optionValues(clientTypeOptions)).catch('comprador'),
  priority: z.enum(optionValues(priorityOptions)).catch(''),
  timeframe: z.enum(optionValues(timeframeOptions)).catch(''),
  financing: z.enum(optionValues(financingOptions)).catch(''),
  source: z.enum(optionValues(sourceOptions)).catch(''),
  // Pode procurar mais do que um tipo (ex.: apartamento ou moradia). Valores inválidos são descartados.
  propertyTypes: z.array(z.unknown()).catch([]).transform((items) => wantKinds.filter((kind) => items.includes(kind))),
  // Pode aceitar várias tipologias (ex.: T2 ou T3). Valores inválidos são descartados.
  typologies: z.array(z.unknown()).catch([]).transform((items) => historyTypologies.filter((value) => items.includes(value))),
  district: z.string().catch(''),
  municipality: z.string().catch(''),
  otherZones: z.string().catch(''),
  budgetMin: optionalPositive,
  budgetMax: optionalPositive,
  // Um valor inválido é descartado sem perder as características válidas.
  features: z.array(z.unknown()).catch([]).transform((items) => items.filter((item): item is (typeof featureOptions)[number]['value'] => typeof item === 'string' && featureValues.includes(item))),
})

const wantsSchema = z.preprocess(migrateWants, wantsObject)

export type ClientWants = z.infer<typeof wantsObject>

export function emptyWants(): ClientWants {
  return { clientType: 'comprador', priority: '', timeframe: '', financing: '', source: '', propertyTypes: [], typologies: [], district: '', municipality: '', otherZones: '', budgetMin: null, budgetMax: null, features: [] }
}

const clientSchema = z.object({
  id: z.string(),
  name: z.string().catch(''),
  phone: z.string().catch(''),
  email: z.string().catch(''),
  startedAt: isoDate,
  status: z.enum(['procura', 'comprou', 'desistiu']).catch('procura'),
  notes: z.string().catch(''),
  learned: z.string().catch(''),
  visits: listOf(visitSchema),
  purchase: purchaseSchema.nullable().catch(null),
  lastContactAt: isoDate,
  followUpAt: isoDate,
  wants: wantsSchema.catch(() => emptyWants()),
})

export type Visit = z.infer<typeof visitSchema>
export type Purchase = z.infer<typeof purchaseSchema>
export type HistoryClient = z.infer<typeof clientSchema>

export function parseHistory(raw: unknown): HistoryClient[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const parsed = clientSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

// ---------- Datas ----------

export function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function formatDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—'
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

// Meses que o prazo escolhido dá ao consultor, contados desde que o cliente entrou na carteira ("mais de 6 meses" conta como 12).
const timeframeMonths: Record<string, number> = { imediato: 1, '1-3-meses': 3, '3-6-meses': 6, 'mais-6-meses': 12 }

export type PurchaseWindow =
  | { state: 'sem-prazo' }
  // `elapsed` é a parte do prazo já gasta, de 0 a 1 (1 se ultrapassado).
  | { state: 'a-decorrer' | 'ultrapassado'; deadline: string; days: number; elapsed: number }

// Prazo que falta para o cliente comprar: é a margem que o consultor ainda tem. `days` é positivo se faltam dias, ou os dias de atraso.
export function purchaseWindow(client: Pick<HistoryClient, 'startedAt' | 'wants'>, today: string): PurchaseWindow {
  const months = timeframeMonths[client.wants.timeframe]
  if (!months || !/^\d{4}-\d{2}-\d{2}$/.test(client.startedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return { state: 'sem-prazo' }
  const end = new Date(`${client.startedAt}T12:00:00Z`)
  end.setUTCMonth(end.getUTCMonth() + months)
  const deadline = end.toISOString().slice(0, 10)
  const diff = Math.round((end.getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000)
  const total = Math.max(1, Math.round((end.getTime() - new Date(`${client.startedAt}T12:00:00Z`).getTime()) / 86400000))
  const elapsed = Math.min(1, Math.max(0, (total - diff) / total))
  return diff >= 0 ? { state: 'a-decorrer', deadline, days: diff, elapsed } : { state: 'ultrapassado', deadline, days: -diff, elapsed: 1 }
}

export function describePurchaseWindow(window: PurchaseWindow) {
  if (window.state === 'sem-prazo') return 'Sem prazo definido'
  const days = `${window.days} ${window.days === 1 ? 'dia' : 'dias'}`
  if (window.state === 'ultrapassado') return `Prazo ultrapassado há ${days} (era ${formatDate(window.deadline)})`
  return window.days === 0 ? `Prazo termina hoje (${formatDate(window.deadline)})` : `Faltam ${days} (até ${formatDate(window.deadline)})`
}

// "há 12 dias", "há 3 meses", "há 1 ano e 2 meses". Vazio se a data for inválida ou futura.
export function timeSince(iso: string, today: string) {
  const iso10 = /^\d{4}-\d{2}-\d{2}$/
  if (!iso10.test(iso) || !iso10.test(today) || iso > today) return ''
  const [y1, m1, d1] = iso.split('-').map(Number)
  const [y2, m2, d2] = today.split('-').map(Number)
  const totalMonths = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0)
  if (totalMonths < 1) {
    const days = Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${iso}T12:00:00Z`).getTime()) / 86400000)
    return days === 0 ? 'hoje' : `há ${days} ${days === 1 ? 'dia' : 'dias'}`
  }
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  const yearText = `${years} ${years === 1 ? 'ano' : 'anos'}`
  const monthText = `${months} ${months === 1 ? 'mês' : 'meses'}`
  if (years === 0) return `há ${monthText}`
  return months === 0 ? `há ${yearText}` : `há ${yearText} e ${monthText}`
}

export function monthYear(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
}

// ---------- Criação ----------

export function newClient(today: string): HistoryClient {
  return { id: crypto.randomUUID(), name: '', phone: '', email: '', startedAt: today, status: 'procura', notes: '', learned: '', visits: [], purchase: null, lastContactAt: '', followUpAt: '', wants: emptyWants() }
}

export function newVisit(today: string): Visit {
  return { id: crypto.randomUUID(), date: today, property: '', url: '', interest: '', notes: '' }
}

export function newPurchase(today: string): Purchase {
  return { date: today, propertyType: 'apartamento', typology: '', location: '', priceEur: null, areaM2: null, description: '' }
}

// ---------- Estatísticas ----------

export function visitStats(client: Pick<HistoryClient, 'visits'>) {
  const dates = client.visits.map((visit) => visit.date).filter(Boolean).sort()
  return {
    count: client.visits.length,
    last: dates.length > 0 ? dates[dates.length - 1] : '',
    liked: client.visits.filter((visit) => visit.interest === 'gostou').length,
  }
}

export function describePurchase(purchase: Purchase, withPrice = true) {
  const kind = houseTypeLabel[purchase.propertyType].toLowerCase()
  const parts = [purchase.typology ? `${kind} ${purchase.typology}` : kind]
  if (purchase.location.trim()) parts.push(`em ${purchase.location.trim()}`)
  if (withPrice && purchase.priceEur !== null) parts.push(`(${formatEur(purchase.priceEur)})`)
  return parts.join(' ')
}

export function clientStatusLabel(status: HistoryClient['status']) {
  return statusLabel[status]
}

// ---------- Pesquisa ----------

export type HistoryFilters = {
  text: string
  status: '' | HistoryClient['status']
  purchasedFrom: string
  purchasedTo: string
  propertyType: '' | Purchase['propertyType']
  typology: string
  location: string
}

export const emptyFilters: HistoryFilters = { text: '', status: '', purchasedFrom: '', purchasedTo: '', propertyType: '', typology: '', location: '' }

export function hasActiveFilters(filters: HistoryFilters) {
  return Object.entries(filters).some(([, value]) => String(value).trim() !== '')
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// A compra só conta quando o cliente está como "Comprou". Os filtros de período, tipo, tipologia e localização
// aplicam-se à casa comprada: clientes sem compra ficam de fora quando algum deles está ativo.
export function filterClients(clients: HistoryClient[], filters: HistoryFilters) {
  const text = normalize(filters.text.trim())
  const location = normalize(filters.location.trim())
  const needsPurchase = Boolean(filters.purchasedFrom || filters.purchasedTo || filters.propertyType || filters.typology || location)

  return clients.filter((client) => {
    if (filters.status && client.status !== filters.status) return false
    const purchase = client.status === 'comprou' ? client.purchase : null

    if (needsPurchase) {
      if (!purchase) return false
      if (filters.purchasedFrom && (!purchase.date || purchase.date < filters.purchasedFrom)) return false
      if (filters.purchasedTo && (!purchase.date || purchase.date > filters.purchasedTo)) return false
      if (filters.propertyType && purchase.propertyType !== filters.propertyType) return false
      if (filters.typology && purchase.typology !== filters.typology) return false
      if (location && !normalize(purchase.location).includes(location)) return false
    }

    if (text) {
      const haystack = normalize([
        client.name, client.email, client.phone, client.notes, client.learned,
        purchase ? `${purchase.location} ${purchase.description}` : '',
        ...client.visits.map((visit) => `${visit.property} ${visit.notes}`),
      ].join(' '))
      if (!haystack.includes(text)) return false
    }
    return true
  })
}

// Mais recentes primeiro: pela data da compra (se comprou) ou pela data de início.
export function sortClients(clients: HistoryClient[]) {
  const key = (client: HistoryClient) => (client.status === 'comprou' && client.purchase?.date) || client.startedAt || ''
  return [...clients].sort((a, b) => key(b).localeCompare(key(a)) || a.name.localeCompare(b.name, 'pt'))
}

// ---------- Contacto ----------

export type ContactKind = 'vender' | 'retomar'

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? ''
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function contactSubject(kind: ContactKind) {
  return kind === 'vender' ? 'Possível comprador para casas como a que adquiriste' : 'Novas opções para a tua procura'
}

export function buildContactMessage(kind: ContactKind, client: HistoryClient, signature: string) {
  const greeting = firstName(client.name) ? `Olá ${firstName(client.name)},` : 'Olá,'
  const lines: string[] = [greeting, '']

  if (kind === 'vender') {
    const purchase = client.status === 'comprou' ? client.purchase : null
    const when = purchase ? monthYear(purchase.date) : ''
    lines.push(`Espero que esteja tudo bem. Foi um prazer acompanhar a tua compra${when ? ` em ${when}` : ''}${purchase ? ` (${describePurchase(purchase, false)})` : ''}.`)
    lines.push('', 'Surgiu agora um possível comprador interessado em imóveis semelhantes. Estás a pensar vender a casa, ou conheces alguém que queira? Posso avaliá-la sem compromisso.')
  } else {
    lines.push('Há algum tempo que não falamos e quis saber como vai a tua procura de casa.')
    lines.push('', 'Entretanto surgiram novos imóveis. Se ainda estás interessado, atualizo a pesquisa com o que fomos aprendendo nas visitas. Diz-me se continuas à procura e do que gostavas.')
  }
  if (signature.trim()) lines.push('', signature.trim())
  return lines.join('\n')
}

export function mailtoUrl(email: string, subject: string, body: string) {
  if (!isEmail(email)) return ''
  return `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// ---------- Cópia de segurança ----------

export function serializeBackup(clients: HistoryClient[], now = new Date()) {
  return JSON.stringify({ app: 'casanexa-historico', version: 1, exportedAt: now.toISOString(), clients }, null, 2)
}

export function parseBackup(text: string): { clients: HistoryClient[]; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { clients: [], error: 'O ficheiro não é uma cópia válida (JSON inválido).' }
  }
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? (raw as { clients?: unknown }).clients : undefined
  const clients = parseHistory(list)
  if (clients.length === 0) return { clients: [], error: 'O ficheiro não tem clientes utilizáveis.' }
  return { clients, error: '' }
}

// Junta a cópia ao histórico atual: clientes com o mesmo id são substituídos, os restantes são acrescentados.
export function mergeClients(current: HistoryClient[], imported: HistoryClient[]) {
  const byId = new Map(current.map((client) => [client.id, client]))
  let added = 0
  let updated = 0
  for (const client of imported) {
    if (byId.has(client.id)) updated += 1
    else added += 1
    byId.set(client.id, client)
  }
  return { merged: [...byId.values()], added, updated }
}

// ---------- Migração dos clientes da antiga "Caixa de entrada" ----------

const legacyDemoClientIds = new Set(['c1', 'c2', 'c3'])

// Os clientes criados à mão na antiga "Caixa de entrada" passam para o histórico, com o mesmo id (as marcações
// da agenda continuam a apontar para eles). Os três clientes de exemplo são descartados.
export function migrateLegacyClients(legacyRaw: unknown, existing: HistoryClient[]) {
  if (!Array.isArray(legacyRaw)) return { clients: existing, imported: 0 }
  const known = new Set(existing.map((client) => client.id))
  const converted: HistoryClient[] = []
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

  for (const item of legacyRaw) {
    if (!item || typeof item !== 'object') continue
    const legacy = item as Record<string, unknown>
    const id = text(legacy.id)
    if (!id || legacyDemoClientIds.has(id) || known.has(id)) continue
    const budget = typeof legacy.budget === 'number' && legacy.budget > 0 ? formatEur(legacy.budget) : ''
    const wants = [text(legacy.typology), text(legacy.zone) ? `em ${text(legacy.zone)}` : '', budget ? `até ${budget}` : ''].filter(Boolean).join(' ')
    const followUp = text(legacy.followUp).slice(0, 10)
    const notes = [text(legacy.notes), legacy.wantsToSell === true ? 'Tem interesse em vender.' : '', text(legacy.stage) ? `Fase anterior: ${text(legacy.stage)}.` : ''].filter(Boolean).join(' ')
    converted.push({
      ...newClient(''),
      id,
      name: text(legacy.name),
      phone: text(legacy.phone),
      email: text(legacy.email),
      notes,
      learned: wants,
      followUpAt: /^\d{4}-\d{2}-\d{2}$/.test(followUp) ? followUp : '',
    })
  }
  return { clients: [...existing, ...converted], imported: converted.length }
}

// ---------- Carteira de clientes ----------

export type PortfolioFilters = {
  text: string
  status: '' | HistoryClient['status']
  clientType: '' | ClientWants['clientType']
  priority: '' | 'quente' | 'morno' | 'frio'
  propertyType: '' | WantKind
  zone: string
  budgetFrom: number | null
  budgetTo: number | null
}

export const emptyPortfolioFilters: PortfolioFilters = { text: '', status: '', clientType: '', priority: '', propertyType: '', zone: '', budgetFrom: null, budgetTo: null }

export function hasActivePortfolioFilters(filters: PortfolioFilters) {
  return Object.values(filters).some((value) => value !== null && String(value).trim() !== '')
}

const districtLabel = Object.fromEntries(districts.map((district) => [district.value, district.label])) as Record<string, string>

export function filterPortfolio(clients: HistoryClient[], filters: PortfolioFilters) {
  const text = normalize(filters.text.trim())
  const zone = normalize(filters.zone.trim())
  const budgetActive = filters.budgetFrom !== null || filters.budgetTo !== null

  return clients.filter((client) => {
    const { wants } = client
    if (filters.status && client.status !== filters.status) return false
    if (filters.clientType && wants.clientType !== filters.clientType) return false
    if (filters.priority && wants.priority !== filters.priority) return false
    if (filters.propertyType && !wants.propertyTypes.includes(filters.propertyType)) return false
    if (zone && !normalize(`${wants.municipality} ${wants.otherZones} ${districtLabel[wants.district] ?? ''}`).includes(zone)) return false

    // O orçamento do cliente (mínimo a máximo) tem de se sobrepor ao intervalo pedido.
    if (budgetActive) {
      const max = wants.budgetMax ?? wants.budgetMin
      const min = wants.budgetMin ?? 0
      if (max === null) return false
      if (filters.budgetFrom !== null && max < filters.budgetFrom) return false
      if (filters.budgetTo !== null && min > filters.budgetTo) return false
    }

    if (text) {
      const haystack = normalize([
        client.name, client.email, client.phone, client.notes, client.learned,
        wants.municipality, wants.otherZones, wants.typologies.join(' '),
        client.purchase ? client.purchase.location : '',
      ].join(' '))
      if (!haystack.includes(text)) return false
    }
    return true
  })
}

const statusRank: Record<HistoryClient['status'], number> = { procura: 0, comprou: 1, desistiu: 2 }
const priorityRank: Record<string, number> = { quente: 0, morno: 1, frio: 2, '': 3 }

// Primeiro quem ainda procura, depois por prioridade, depois pelo próximo contacto mais próximo.
export function sortPortfolio(clients: HistoryClient[]) {
  return [...clients].sort((a, b) =>
    statusRank[a.status] - statusRank[b.status]
    || priorityRank[a.wants.priority] - priorityRank[b.wants.priority]
    || (a.followUpAt || '9999').localeCompare(b.followUpAt || '9999')
    || a.name.localeCompare(b.name, 'pt'))
}

export function portfolioStats(clients: HistoryClient[]) {
  return {
    total: clients.length,
    procura: clients.filter((client) => client.status === 'procura').length,
    comprou: clients.filter((client) => client.status === 'comprou').length,
    desistiu: clients.filter((client) => client.status === 'desistiu').length,
    quentes: clients.filter((client) => client.status === 'procura' && client.wants.priority === 'quente').length,
  }
}

export function describeWants(wants: ClientWants) {
  const kind = wants.propertyTypes.map((value) => houseTypeLabel[value].toLowerCase()).join(' ou ')
  const type = wants.typologies.length > 0 ? `${kind || 'imóvel'} ${wants.typologies.join('/')}` : kind
  const zone = [wants.municipality.trim(), wants.otherZones.trim()].filter(Boolean).join(', ')
  const { budgetMin, budgetMax } = wants
  const budget = budgetMin !== null && budgetMax !== null ? `${formatEur(budgetMin)} a ${formatEur(budgetMax)}` : budgetMax !== null ? `até ${formatEur(budgetMax)}` : budgetMin !== null ? `desde ${formatEur(budgetMin)}` : ''
  return [type, zone, budget].filter(Boolean).join(' · ')
}

export function optionLabel(options: readonly { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? ''
}
