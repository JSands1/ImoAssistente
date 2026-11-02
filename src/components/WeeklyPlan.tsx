import { useState } from 'react'
import type { PlanTask, TaskPriority, WeeklyPlan as Plan } from '../lib/weekly-plan'
import './WeeklyPlan.css'

type Props = {
  plan: Plan
  /** Nomes dos clientes, para mostrar quem falha em cada verificação. */
  names: Record<string, string>
  onOpenTask: (task: PlanTask) => void
  onOpenClient: (clientId: string) => void
}

const weekday = new Intl.DateTimeFormat('pt-PT', { weekday: 'long' })
const shortDate = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' })
const parse = (date: string) => new Date(`${date}T12:00:00`)
const priorityLabel: Record<TaskPriority, string> = { 1: 'Urgente', 2: 'Esta semana', 3: 'Se houver tempo' }
const visibleTasks = 4
const clean = (text: string) => text.replace('.', '')
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours === 0 ? `${rest} min` : rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export default function WeeklyPlan({ plan, names, onOpenTask, onOpenClient }: Props) {
  const [expanded, setExpanded] = useState<string[]>([])
  const { stats } = plan

  const summary = stats.tasks === 0 && stats.visits === 0
    ? 'Sem tarefas nem visitas para os próximos dias.'
    : [plural(stats.visits, 'visita marcada', 'visitas marcadas'), plural(stats.contacts, 'cliente para contactar', 'clientes para contactar'), stats.urgent > 0 ? plural(stats.urgent, 'tarefa urgente', 'tarefas urgentes') : 'nada urgente'].join(' · ')

  return (
    <section className="dash-panel weekly-plan" aria-label="Análise da semana">
      <div className="panel-heading">
        <div><span className="eyebrow">ANÁLISE DA SEMANA</span><h3>O que fazer nos próximos dias</h3></div>
        <span className="weekly-range">{clean(shortDate.format(parse(plan.start)))} – {clean(shortDate.format(parse(plan.end)))}</span>
      </div>
      <p className="weekly-summary">{summary}</p>

      <div className="weekly-days">
        {plan.days.map((day) => {
          const open = expanded.includes(day.date)
          const shown = open ? day.tasks : day.tasks.slice(0, visibleTasks)
          return (
            <article className={day.isToday ? 'weekly-day is-today' : 'weekly-day'} key={day.date}>
              <header>
                <strong>{capital(weekday.format(parse(day.date)))}</strong>
                <span>{clean(shortDate.format(parse(day.date)))}{day.isToday ? ' · hoje' : ''}</span>
              </header>
              <p className="weekly-day-visits">{day.visits > 0 ? `${plural(day.visits, 'visita', 'visitas')} · ${duration(day.visitMinutes)}` : 'Sem visitas'}</p>
              {day.tasks.length === 0 && <p className="weekly-day-empty">Dia livre para prospeção e imprevistos.</p>}
              <ul>
                {shown.map((task) => (
                  <li key={task.id}>
                    <button className={`weekly-task p${task.priority}`} type="button" title={`${priorityLabel[task.priority]} · ${task.detail}`} onClick={() => onOpenTask(task)}>
                      <i aria-label={priorityLabel[task.priority]} />
                      <span><strong>{task.title}</strong><small>{task.detail}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
              {day.tasks.length > visibleTasks && (
                <button className="inline-link" type="button" onClick={() => setExpanded((current) => open ? current.filter((item) => item !== day.date) : [...current, day.date])}>
                  {open ? 'Mostrar menos' : `Mais ${day.tasks.length - visibleTasks}`}
                </button>
              )}
            </article>
          )
        })}
      </div>
      <div className="weekly-legend"><span><i className="p1" /> Urgente</span><span><i className="p2" /> Esta semana</span><span><i className="p3" /> Se houver tempo</span></div>

      {plan.health.length > 0 && (
        <div className="weekly-health">
          <h4>Os clientes estão a ser bem acompanhados?</h4>
          <div className="weekly-health-grid">
            {plan.health.map((check) => (
              <div className={`weekly-check ${check.level}`} key={check.id}>
                <div className="weekly-check-head"><strong>{check.label}</strong><span>{check.ok} de {check.total}</span></div>
                <div className="weekly-bar" role="img" aria-label={`${check.ok} de ${check.total}`}><i style={{ width: `${check.total === 0 ? 0 : (check.ok / check.total) * 100}%` }} /></div>
                <small>{check.hint}</small>
                {check.clientIds.length > 0 && (
                  <p className="weekly-missing">Em falta: {check.clientIds.slice(0, 4).map((id) => <button className="match-chip" type="button" key={id} onClick={() => onOpenClient(id)}>{names[id] || 'Sem nome'}</button>)}{check.clientIds.length > 4 ? ` e mais ${check.clientIds.length - 4}` : ''}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
