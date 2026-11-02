// Cálculos do calendário semanal: dias da semana, formato dos campos de data e posição dos blocos de cada visita.

export const defaultVisitMinutes = 60

export type WeekEvent = {
  id: string
  /** Início, no formato dos campos de data e hora (AAAA-MM-DDTHH:mm), em hora local. */
  start: string
  minutes: number
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Data e hora no formato do campo `datetime-local`. */
export function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function dayKey(date: Date) {
  return toLocalInput(date).slice(0, 10)
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Segunda-feira (à meia-noite) da semana em que a data cai. */
export function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

export function weekDays(start: Date) {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

/** Duração guardada numa visita; sem valor válido, uma hora. */
export function visitMinutes(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 15 && value <= 480 ? Math.round(value) : defaultVisitMinutes
}

function minutesOfDay(start: string) {
  const date = new Date(start)
  return date.getHours() * 60 + date.getMinutes()
}

export type PlacedEvent = { id: string; top: number; height: number; column: number; columns: number }

/**
 * Posição dos blocos de um dia, em minutos a contar de `fromMinute`. Visitas que se sobrepõem ficam lado a lado,
 * cada uma na sua coluna.
 */
export function placeDay(events: WeekEvent[], fromMinute: number): PlacedEvent[] {
  const sorted = events
    .map((event) => ({ id: event.id, start: minutesOfDay(event.start), end: minutesOfDay(event.start) + event.minutes }))
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const placed: PlacedEvent[] = []
  let cluster: Array<{ id: string; start: number; end: number; column: number }> = []
  let clusterEnd = -1
  const flush = () => {
    const columns = cluster.reduce((most, item) => Math.max(most, item.column + 1), 0)
    for (const item of cluster) placed.push({ id: item.id, top: item.start - fromMinute, height: item.end - item.start, column: item.column, columns })
    cluster = []
  }
  for (const item of sorted) {
    if (cluster.length > 0 && item.start >= clusterEnd) { flush(); clusterEnd = -1 }
    const taken = new Set(cluster.filter((other) => other.end > item.start).map((other) => other.column))
    let column = 0
    while (taken.has(column)) column += 1
    cluster.push({ ...item, column })
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()
  return placed
}

/** Horas visíveis no calendário: o horário normal de trabalho, alargado se houver visitas fora dele. */
export function visibleHours(events: WeekEvent[], defaultFrom = 8, defaultTo = 20) {
  let from = defaultFrom
  let to = defaultTo
  for (const event of events) {
    const start = minutesOfDay(event.start)
    from = Math.min(from, Math.floor(start / 60))
    to = Math.max(to, Math.min(24, Math.ceil((start + event.minutes) / 60)))
  }
  return { from, to }
}

/** Outra visita que ocupe o mesmo horário. */
export function findConflict(events: WeekEvent[], start: string, minutes: number) {
  const from = new Date(start).getTime()
  if (Number.isNaN(from)) return undefined
  const to = from + minutes * 60000
  return events.find((event) => {
    const otherFrom = new Date(event.start).getTime()
    return otherFrom < to && otherFrom + event.minutes * 60000 > from
  })
}
