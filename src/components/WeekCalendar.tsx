import { useState, type MouseEvent } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { addDays, dayKey, placeDay, startOfWeek, toLocalInput, visibleHours, weekDays, type WeekEvent } from '../lib/week'
import './WeekCalendar.css'

export type CalendarEvent = WeekEvent & { title: string; subtitle: string; /** Morada, link e contacto, para o texto ao passar o rato. */ details?: string }

type Props = {
  events: CalendarEvent[]
  now: number
  /** Clique numa hora livre: recebe o início (AAAA-MM-DDTHH:mm) para marcar uma visita aí. */
  onSlot: (start: string) => void
  onRemove: (id: string) => void
}

const hourHeight = 52
const slotMinutes = 30

const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const weekdayNames = new Intl.DateTimeFormat('pt-PT', { weekday: 'short' })
const monthNames = new Intl.DateTimeFormat('pt-PT', { month: 'short' })
const shortDate = (date: Date) => `${date.getDate()} ${monthNames.format(date).replace('.', '')}`

function weekLabel(start: Date) {
  const end = addDays(start, 6)
  const year = end.getFullYear()
  return `${shortDate(start)} – ${shortDate(end)} ${year}`
}

export default function WeekCalendar({ events, now, onSlot, onRemove }: Props) {
  const [start, setStart] = useState(() => startOfWeek(new Date()))
  const days = weekDays(start)
  const keys = days.map(dayKey)
  const inWeek = events.filter((event) => keys.includes(event.start.slice(0, 10)))
  const { from, to } = visibleHours(inWeek)
  const hours = Array.from({ length: to - from }, (_, index) => from + index)
  const today = dayKey(new Date(now))
  const nowDate = new Date(now)
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes()
  const isCurrentWeek = keys.includes(today)

  function pickSlot(event: MouseEvent<HTMLDivElement>, day: Date) {
    const rect = event.currentTarget.getBoundingClientRect()
    const minutes = from * 60 + Math.floor(((event.clientY - rect.top) / hourHeight) * 60 / slotMinutes) * slotMinutes
    const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60)
    onSlot(toLocalInput(date))
  }

  return (
    <section className="dash-panel week-calendar" aria-label="Calendário semanal" data-collapse-memory="off">
      <div className="week-toolbar">
        <div className="week-title"><span className="eyebrow">CALENDÁRIO SEMANAL</span><h3>{weekLabel(start)}</h3></div>
        <span className="week-count">{inWeek.length} {inWeek.length === 1 ? 'visita' : 'visitas'} nesta semana</span>
        <div className="week-nav">
          <button className="dash-button" type="button" aria-label="Semana anterior" onClick={() => setStart((current) => addDays(current, -7))}><ChevronLeft size={15} /></button>
          <button className="dash-button" type="button" disabled={isCurrentWeek} onClick={() => setStart(startOfWeek(new Date()))}>Hoje</button>
          <button className="dash-button" type="button" aria-label="Semana seguinte" onClick={() => setStart((current) => addDays(current, 7))}><ChevronRight size={15} /></button>
        </div>
      </div>

      <div className="week-scroll">
        <div className="week-grid">
          <div className="week-corner" />
          {days.map((day, index) => (
            <div className={keys[index] === today ? 'week-day-head is-today' : 'week-day-head'} key={keys[index]}>
              <span>{weekdayNames.format(day).replace('.', '')}</span><strong>{day.getDate()}</strong>
            </div>
          ))}

          <div className="week-hours" style={{ height: hours.length * hourHeight }}>
            {hours.map((hour) => <span key={hour} style={{ top: (hour - from) * hourHeight }}>{clock(hour * 60)}</span>)}
          </div>
          {days.map((day, index) => {
            const dayEvents = inWeek.filter((event) => event.start.slice(0, 10) === keys[index])
            const placed = placeDay(dayEvents, from * 60)
            return (
              <div
                className={keys[index] === today ? 'week-column is-today' : 'week-column'}
                key={keys[index]}
                style={{ height: hours.length * hourHeight, backgroundSize: `100% ${hourHeight}px` }}
                title="Clica numa hora livre para marcar uma visita"
                onClick={(event) => pickSlot(event, day)}
              >
                {keys[index] === today && nowMinutes >= from * 60 && nowMinutes < to * 60 && <i className="week-now" style={{ top: ((nowMinutes - from * 60) / 60) * hourHeight }} />}
                {placed.map((block) => {
                  const event = dayEvents.find((item) => item.id === block.id)
                  if (!event) return null
                  const minutes = Math.round(block.top + from * 60)
                  return (
                    <article
                      className="week-event"
                      key={block.id}
                      style={{ top: (block.top / 60) * hourHeight, height: Math.max((block.height / 60) * hourHeight - 2, 22), left: `calc(${(block.column / block.columns) * 100}% + 2px)`, width: `calc(${100 / block.columns}% - 4px)` }}
                      title={`${event.title} · ${event.subtitle} · ${clock(minutes)}–${clock(minutes + block.height)}${event.details ? `
${event.details}` : ''}`}
                      onClick={(click) => click.stopPropagation()}
                    >
                      <strong>{event.title}</strong>
                      <span>{clock(minutes)}–{clock(minutes + block.height)}</span>
                      {block.height >= 45 && <small>{event.subtitle}</small>}
                      <button type="button" aria-label={`Remover a visita de ${event.title}`} onClick={() => onRemove(event.id)}><X size={12} /></button>
                    </article>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div className="week-legend"><span>Clica numa hora livre para marcar uma visita.</span></div>
    </section>
  )
}
