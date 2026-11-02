import { formatDate, purchaseWindow, type HistoryClient } from './history'
import { addDays, dayKey, toLocalInput, visitMinutes } from './week'

// Análise da semana: lê a carteira, as visitas e os imóveis e propõe o que fazer em cada um dos próximos dias úteis.
// Tudo calculado no browser, sem IA: são regras simples sobre os dados que já existem.

export type PlanAppointment = { id: string; clientId: string; propertyId: string; date: string; minutes?: number }
export type PlanProperty = { id: string; reference: string; title: string; status: string; lastVerified: string }

export type PlanInput = {
  clients: HistoryClient[]
  appointments: PlanAppointment[]
  properties: PlanProperty[]
  now: Date
}

export type TaskKind = 'contactar' | 'visita' | 'feedback' | 'marcar-visita' | 'imoveis' | 'fichas' | 'prospecao' | 'pos-venda'
/** 1 = fazer já, 2 = esta semana, 3 = quando houver tempo. */
export type TaskPriority = 1 | 2 | 3
export type TaskTarget = 'portfolio' | 'history' | 'calendar' | 'properties' | 'search'

export type PlanTask = {
  id: string
  kind: TaskKind
  priority: TaskPriority
  title: string
  detail: string
  /** Dia (AAAA-MM-DD) em que a tarefa faz sentido, se tiver data própria. */
  day?: string
  clientId?: string
  target: TaskTarget
}

export type PlanDay = {
  date: string
  isToday: boolean
  visits: number
  visitMinutes: number
  tasks: PlanTask[]
}

export type CheckLevel = 'bom' | 'atencao' | 'mau'
export type HealthCheck = {
  id: string
  label: string
  /** Clientes em procura que cumprem o critério e o total de clientes em procura. */
  ok: number
  total: number
  level: CheckLevel
  hint: string
  clientIds: string[]
}

export type WeeklyPlan = {
  start: string
  end: string
  days: PlanDay[]
  tasks: PlanTask[]
  health: HealthCheck[]
  stats: { visits: number; contacts: number; tasks: number; urgent: number }
}

const dayMs = 86400000
const iso = /^\d{4}-\d{2}-\d{2}$/

/** Dias entre duas datas AAAA-MM-DD (positivo se `to` for depois de `from`). */
export function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / dayMs)
}

/** Os próximos seis dias úteis, a começar hoje (ou na segunda-feira, ao fim de semana). */
export function workingDays(now: Date, count = 6) {
  let day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days: string[] = []
  while (days.length < count) {
    if (day.getDay() !== 0 && day.getDay() !== 6) days.push(dayKey(day))
    day = addDays(day, 1)
  }
  return days
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
const nameOf = (client: HistoryClient) => client.name.trim() || 'Cliente sem nome'
const contactThreshold = (priority: HistoryClient['wants']['priority']) => (priority === 'quente' ? 7 : priority === 'frio' ? 21 : 14)
const best = (a: TaskPriority, b: TaskPriority): TaskPriority => (a < b ? a : b)

type Reason = { text: string; priority: TaskPriority; day?: string }

function contactReasons(client: HistoryClient, today: string, days: string[]): Reason[] {
  const reasons: Reason[] = []
  if (client.followUpAt) {
    if (client.followUpAt < today) reasons.push({ text: `Follow-up marcado para ${formatDate(client.followUpAt)} (em atraso)`, priority: 1 })
    else if (client.followUpAt === today) reasons.push({ text: 'Follow-up marcado para hoje', priority: 1, day: today })
    else if (days.includes(client.followUpAt)) reasons.push({ text: `Follow-up marcado para ${formatDate(client.followUpAt)}`, priority: 2, day: client.followUpAt })
  }
  const lastContact = client.lastContactAt || client.startedAt
  if (iso.test(lastContact)) {
    const since = daysBetween(lastContact, today)
    if (since > contactThreshold(client.wants.priority)) {
      const hot = client.wants.priority === 'quente'
      reasons.push({ text: `${client.lastContactAt ? 'Sem contacto' : 'Ainda sem contacto registado'} há ${plural(since, 'dia', 'dias')}`, priority: hot ? 1 : client.wants.priority === 'frio' ? 3 : 2 })
    }
  }
  const window = purchaseWindow(client, today)
  if (window.state === 'ultrapassado') reasons.push({ text: `Prazo de compra ultrapassado há ${plural(window.days, 'dia', 'dias')}`, priority: 2 })
  else if (window.state === 'a-decorrer' && window.days <= 14) reasons.push({ text: `O prazo de compra termina em ${plural(window.days, 'dia', 'dias')}`, priority: 2 })
  return reasons
}

/** Tarefas que a carteira, as visitas e os imóveis pedem, por ordem de importância. */
export function buildTasks({ clients, appointments, properties, now }: PlanInput, days: string[]): PlanTask[] {
  const today = dayKey(now)
  const tasks: PlanTask[] = []
  const searching = clients.filter((client) => client.status === 'procura')

  for (const client of searching) {
    const reasons = contactReasons(client, today, days)
    if (reasons.length === 0) continue
    const priority = reasons.reduce<TaskPriority>((current, reason) => best(current, reason.priority), 3)
    const dated = reasons.length === 1 ? reasons[0].day : undefined
    tasks.push({ id: `contactar-${client.id}`, kind: 'contactar', priority, title: `Contactar ${nameOf(client)}`, detail: reasons.map((reason) => reason.text).join(' · '), day: dated, clientId: client.id, target: 'portfolio' })
  }

  // Visitas já marcadas: confirmar com o cliente as de hoje e de amanhã.
  const tomorrow = dayKey(addDays(now, 1))
  for (const appointment of appointments) {
    const date = appointment.date.slice(0, 10)
    if (Number.isNaN(Date.parse(appointment.date)) || appointment.date < toLocalInput(now) || (date !== today && date !== tomorrow)) continue
    const client = clients.find((item) => item.id === appointment.clientId)
    const hour = appointment.date.slice(11, 16)
    tasks.push({ id: `visita-${appointment.id}`, kind: 'visita', priority: 1, title: `Confirmar a visita com ${client ? nameOf(client) : 'o cliente'}`, detail: `${date === today ? 'Hoje' : 'Amanhã'} às ${hour}. Confirma a hora e a morada com o cliente e com o vendedor.`, day: today, clientId: client?.id, target: 'calendar' })
  }

  // Clientes quentes sem visita à vista.
  const upcoming = new Set(appointments.filter((appointment) => appointment.date >= toLocalInput(now)).map((appointment) => appointment.clientId))
  for (const client of searching) {
    if (client.wants.priority !== 'quente' || upcoming.has(client.id)) continue
    tasks.push({ id: `marcar-${client.id}`, kind: 'marcar-visita', priority: 1, title: `Marcar visitas para ${nameOf(client)}`, detail: 'Cliente quente sem nenhuma visita marcada. Propõe imóveis que encaixem e agenda.', clientId: client.id, target: 'search' })
  }

  // Visitas recentes ainda sem opinião registada.
  for (const client of clients) {
    const pending = client.visits.filter((visit) => visit.date && visit.date <= today && daysBetween(visit.date, today) <= 14 && !visit.interest && !visit.notes.trim())
    if (pending.length === 0) continue
    tasks.push({ id: `feedback-${client.id}`, kind: 'feedback', priority: 2, title: `Registar o que ${nameOf(client)} achou`, detail: `${plural(pending.length, 'visita recente sem opinião nem notas', 'visitas recentes sem opinião nem notas')}. Sem isto, perde-se o que o cliente aprendeu a querer.`, clientId: client.id, target: 'history' })
  }

  // Imóveis por confirmar.
  const stale = properties.filter((property) => property.status === 'Disponível' && now.getTime() - Date.parse(property.lastVerified) > 7 * dayMs)
  if (stale.length > 0) tasks.push({ id: 'imoveis-por-confirmar', kind: 'imoveis', priority: 2, title: `Confirmar a disponibilidade de ${plural(stale.length, 'imóvel', 'imóveis')}`, detail: `${stale.slice(0, 3).map((property) => property.reference).join(', ')}${stale.length > 3 ? '…' : ''}: sem confirmação há mais de 7 dias. Confirma antes de os mostrares.`, target: 'properties' })

  // Fichas por completar: sem próximo contacto marcado, ou sem forma de contacto ou orçamento.
  const noNext = searching.filter((client) => !client.followUpAt)
  if (noNext.length > 0) tasks.push({ id: 'definir-proximo-contacto', kind: 'fichas', priority: 3, title: `Definir o próximo contacto de ${plural(noNext.length, 'cliente', 'clientes')}`, detail: `${noNext.slice(0, 3).map(nameOf).join(', ')}${noNext.length > 3 ? '…' : ''}: sem data para voltar a falar. Um cliente sem data de contacto é um cliente esquecido.`, target: 'portfolio' })
  const incomplete = searching.filter((client) => (!client.phone.trim() && !client.email.trim()) || (client.wants.budgetMax === null && client.wants.budgetMin === null))
  if (incomplete.length > 0) tasks.push({ id: 'completar-fichas', kind: 'fichas', priority: 3, title: `Completar a ficha de ${plural(incomplete.length, 'cliente', 'clientes')}`, detail: `${incomplete.slice(0, 3).map(nameOf).join(', ')}${incomplete.length > 3 ? '…' : ''}: falta contacto ou orçamento. Sem isso, as sugestões de imóveis ficam vagas.`, target: 'portfolio' })

  // Pós-venda: clientes que compraram há pouco e a quem ainda não pediste recomendações.
  for (const client of clients.filter((item) => item.status === 'comprou').slice(0, 50)) {
    const bought = client.purchase?.date || client.lastContactAt
    if (!iso.test(bought)) continue
    const since = daysBetween(bought, today)
    const lastContact = client.lastContactAt || bought
    if (since < 0 || since > 120 || daysBetween(lastContact, today) < 30) continue
    tasks.push({ id: `pos-venda-${client.id}`, kind: 'pos-venda', priority: 3, title: `Pós-venda com ${nameOf(client)}`, detail: 'Comprou há pouco e não falam há mais de um mês. Pergunta como está e pede uma recomendação.', clientId: client.id, target: 'portfolio' })
  }

  // Novos clientes: se a carteira não está a crescer, o trabalho da semana é procurá-los.
  const recent = clients.filter((client) => iso.test(client.startedAt) && daysBetween(client.startedAt, today) <= 30).length
  if (recent < 2) tasks.push({ id: 'prospecao', kind: 'prospecao', priority: 2, title: 'Procurar novos clientes', detail: `${recent === 0 ? 'Nenhum cliente novo' : 'Só 1 cliente novo'} nos últimos 30 dias. Reserva um bloco para pedir recomendações, voltar a contactar antigos contactos e responder a anúncios.`, target: 'portfolio' })
  if (properties.filter((property) => property.status === 'Disponível').length < 3) tasks.push({ id: 'angariar', kind: 'prospecao', priority: 3, title: 'Angariar novos imóveis', detail: 'Tens poucos imóveis disponíveis. Contacta proprietários e agências da zona.', target: 'properties' })

  return tasks.sort((a, b) => a.priority - b.priority || (a.day ?? '9').localeCompare(b.day ?? '9') || a.title.localeCompare(b.title, 'pt'))
}

/** Espalha as tarefas pelos dias: o urgente primeiro, as com data no seu dia e o resto nos dias menos cheios. */
export function distribute(tasks: PlanTask[], days: PlanDay[]) {
  const load = (day: PlanDay) => day.visits * 2 + day.tasks.length
  const quietest = (candidates: PlanDay[]) => candidates.reduce((chosen, day) => (load(day) < load(chosen) ? day : chosen))
  for (const task of tasks) {
    const dated = task.day ? days.find((day) => day.date === task.day) : undefined
    if (dated) { dated.tasks.push(task); continue }
    // O urgente fica nos primeiros dias; o resto vai para onde há mais folga.
    const pool = task.priority === 1 ? days.slice(0, 2) : task.priority === 2 ? days.slice(0, 4) : days
    quietest(pool).tasks.push(task)
  }
}

export function buildWeeklyPlan(input: PlanInput): WeeklyPlan {
  const dates = workingDays(input.now)
  const today = dayKey(input.now)
  const days: PlanDay[] = dates.map((date) => {
    const visits = input.appointments.filter((appointment) => appointment.date.slice(0, 10) === date && !Number.isNaN(Date.parse(appointment.date)))
    return { date, isToday: date === today, visits: visits.length, visitMinutes: visits.reduce((total, visit) => total + visitMinutes(visit.minutes), 0), tasks: [] }
  })
  const tasks = buildTasks(input, dates)
  distribute(tasks, days)

  const searching = input.clients.filter((client) => client.status === 'procura')
  const health = searching.length === 0 ? [] : buildHealth(searching, input.appointments, input.now)
  return {
    start: dates[0],
    end: dates[dates.length - 1],
    days,
    tasks,
    health,
    stats: {
      visits: days.reduce((total, day) => total + day.visits, 0),
      contacts: tasks.filter((task) => task.kind === 'contactar').length,
      tasks: tasks.length,
      urgent: tasks.filter((task) => task.priority === 1).length,
    },
  }
}

function level(ok: number, total: number): CheckLevel {
  const ratio = total === 0 ? 1 : ok / total
  return ratio >= 0.8 ? 'bom' : ratio >= 0.5 ? 'atencao' : 'mau'
}

/** Os clientes em procura estão a ser bem acompanhados? Quatro verificações simples. */
function buildHealth(searching: HistoryClient[], appointments: PlanAppointment[], now: Date): HealthCheck[] {
  const today = dayKey(now)
  const total = searching.length
  const make = (id: string, label: string, hint: string, passing: HistoryClient[]): HealthCheck => ({
    id, label, hint, ok: passing.length, total, level: level(passing.length, total), clientIds: searching.filter((client) => !passing.includes(client)).map((client) => client.id),
  })
  const contacted = searching.filter((client) => {
    const last = client.lastContactAt || client.startedAt
    return iso.test(last) && daysBetween(last, today) <= contactThreshold(client.wants.priority)
  })
  const withNext = searching.filter((client) => client.followUpAt >= today)
  const upcoming = new Set(appointments.filter((appointment) => appointment.date >= toLocalInput(now)).map((appointment) => appointment.clientId))
  const recentVisit = (client: HistoryClient) => client.visits.some((visit) => visit.date && daysBetween(visit.date, today) <= 30)
  const moving = searching.filter((client) => upcoming.has(client.id) || recentVisit(client))
  const complete = searching.filter((client) => (client.phone.trim() || client.email.trim()) && (client.wants.budgetMax !== null || client.wants.budgetMin !== null))
  return [
    make('contacto', 'Contactados dentro do prazo', 'Quentes até 7 dias, mornos até 14 e frios até 21 desde o último contacto.', contacted),
    make('proximo', 'Com próximo contacto marcado', 'Cada cliente em procura deve ter uma data para voltar a falar.', withNext),
    make('movimento', 'Com visitas recentes ou marcadas', 'Visita nos últimos 30 dias ou já agendada. Sem visitas, a procura pára.', moving),
    make('ficha', 'Com a ficha completa', 'Contacto e orçamento preenchidos, para as sugestões de imóveis encaixarem.', complete),
  ]
}
