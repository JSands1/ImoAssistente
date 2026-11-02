import { describe, expect, it } from 'vitest'
import { emptyWants, newClient, type HistoryClient } from './history'
import { buildWeeklyPlan, daysBetween, workingDays, type PlanInput } from './weekly-plan'

// 28 de outubro de 2026 é quarta-feira.
const now = new Date(2026, 9, 28, 10, 0)

function client(id: string, patch: Partial<HistoryClient> & { priority?: 'quente' | 'morno' | 'frio' | '' } = {}): HistoryClient {
  const { priority = '', ...rest } = patch
  return { ...newClient('2026-09-01'), id, name: id, phone: '912', lastContactAt: '2026-10-27', followUpAt: '2026-11-10', wants: { ...emptyWants(), priority, budgetMax: 200000 }, ...rest }
}

const input = (patch: Partial<PlanInput>): PlanInput => ({ clients: [], appointments: [], properties: [], now, ...patch })
const kinds = (plan: ReturnType<typeof buildWeeklyPlan>) => plan.tasks.map((task) => `${task.kind}:${task.clientId ?? ''}`)

describe('dias úteis', () => {
  it('conta seis dias úteis a começar hoje', () => {
    expect(workingDays(now)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04'])
  })
  it('ao fim de semana começa na segunda-feira', () => {
    expect(workingDays(new Date(2026, 10, 1))[0]).toBe('2026-11-02')
  })
  it('daysBetween', () => {
    expect(daysBetween('2026-10-20', '2026-10-28')).toBe(8)
  })
})

describe('tarefas', () => {
  it('follow-up em atraso é urgente e vai para os primeiros dias', () => {
    const plan = buildWeeklyPlan(input({ clients: [client('ana', { followUpAt: '2026-10-20' })] }))
    const task = plan.tasks.find((item) => item.id === 'contactar-ana')
    expect(task?.priority).toBe(1)
    expect(task?.detail).toContain('em atraso')
    expect(plan.days.slice(0, 2).some((day) => day.tasks.some((item) => item.id === 'contactar-ana'))).toBe(true)
  })

  it('follow-up desta semana fica no seu dia', () => {
    const plan = buildWeeklyPlan(input({ clients: [client('rui', { followUpAt: '2026-10-30' })] }))
    expect(plan.days.find((day) => day.date === '2026-10-30')?.tasks.map((task) => task.id)).toContain('contactar-rui')
  })

  it('cliente sem contacto há muito tempo precisa de contacto, conforme a prioridade', () => {
    const quente = buildWeeklyPlan(input({ clients: [client('q', { priority: 'quente', lastContactAt: '2026-10-15' })] }))
    expect(quente.tasks.find((task) => task.id === 'contactar-q')?.priority).toBe(1)
    const frio = buildWeeklyPlan(input({ clients: [client('f', { priority: 'frio', lastContactAt: '2026-10-15' })] }))
    expect(frio.tasks.find((task) => task.id === 'contactar-f')).toBeUndefined()
  })

  it('clientes que compraram ou desistiram não pedem contacto', () => {
    const plan = buildWeeklyPlan(input({ clients: [client('a', { status: 'desistiu', followUpAt: '2026-10-01' }), client('b', { status: 'comprou', followUpAt: '2026-10-01' })] }))
    expect(kinds(plan).filter((item) => item.startsWith('contactar'))).toEqual([])
  })

  it('cliente quente sem visita à vista pede marcação; com visita marcada, não', () => {
    const quente = client('q', { priority: 'quente' })
    expect(kinds(buildWeeklyPlan(input({ clients: [quente] })))).toContain('marcar-visita:q')
    const withVisit = buildWeeklyPlan(input({ clients: [quente], appointments: [{ id: 'v1', clientId: 'q', propertyId: '', date: '2026-10-31T10:00' }] }))
    expect(kinds(withVisit)).not.toContain('marcar-visita:q')
  })

  it('visita de hoje ou de amanhã pede confirmação; as passadas ou distantes não', () => {
    const appointments = [
      { id: 'hoje', clientId: 'a', propertyId: '', date: '2026-10-28T15:00' },
      { id: 'amanha', clientId: 'a', propertyId: '', date: '2026-10-29T09:00' },
      { id: 'passada', clientId: 'a', propertyId: '', date: '2026-10-28T08:00' },
      { id: 'longe', clientId: 'a', propertyId: '', date: '2026-11-03T09:00' },
    ]
    const ids = buildWeeklyPlan(input({ clients: [client('a')], appointments })).tasks.filter((task) => task.kind === 'visita').map((task) => task.id)
    expect(ids.sort()).toEqual(['visita-amanha', 'visita-hoje'])
  })

  it('visitas recentes sem opinião pedem registo', () => {
    const withVisit = client('a', { visits: [{ id: 'x', date: '2026-10-26', property: 'T2', url: '', interest: '', notes: '' }] })
    expect(kinds(buildWeeklyPlan(input({ clients: [withVisit] })))).toContain('feedback:a')
    const done = client('b', { visits: [{ id: 'x', date: '2026-10-26', property: 'T2', url: '', interest: 'gostou', notes: '' }] })
    expect(kinds(buildWeeklyPlan(input({ clients: [done] })))).not.toContain('feedback:b')
  })

  it('imóveis por confirmar juntam-se numa só tarefa', () => {
    const properties = [
      { id: 'p1', reference: 'CN-1', title: 'A', status: 'Disponível', lastVerified: '2026-10-01' },
      { id: 'p2', reference: 'CN-2', title: 'B', status: 'Disponível', lastVerified: '2026-10-02' },
      { id: 'p3', reference: 'CN-3', title: 'C', status: 'Vendido', lastVerified: '2026-09-01' },
    ]
    const task = buildWeeklyPlan(input({ properties })).tasks.find((item) => item.id === 'imoveis-por-confirmar')
    expect(task?.title).toContain('2 imóveis')
  })

  it('carteira parada pede prospeção; com clientes novos, não', () => {
    expect(buildWeeklyPlan(input({ clients: [client('a')] })).tasks.map((task) => task.id)).toContain('prospecao')
    const novos = [client('a', { startedAt: '2026-10-20' }), client('b', { startedAt: '2026-10-25' })]
    expect(buildWeeklyPlan(input({ clients: novos })).tasks.map((task) => task.id)).not.toContain('prospecao')
  })

  it('pós-venda para quem comprou há pouco e não é contactado há mais de um mês', () => {
    const bought = client('c', { status: 'comprou', lastContactAt: '2026-08-20', purchase: { date: '2026-08-10', propertyType: 'apartamento', typology: 'T2', location: '', priceEur: null, areaM2: null, description: '' } })
    expect(kinds(buildWeeklyPlan(input({ clients: [bought] })))).toContain('pos-venda:c')
  })
})

describe('distribuição pelos dias', () => {
  it('visitas pesam: o dia mais cheio recebe menos tarefas livres', () => {
    const appointments = ['2026-10-30T10:00', '2026-10-30T12:00', '2026-10-30T15:00'].map((date, index) => ({ id: `v${index}`, clientId: 'x', propertyId: '', date }))
    const clients = ['a', 'b', 'c'].map((id) => client(id, { priority: 'morno', lastContactAt: '2026-10-05' }))
    const plan = buildWeeklyPlan(input({ clients, appointments }))
    expect(plan.days[2].visits).toBe(3)
    expect(plan.days[2].tasks.length).toBeLessThanOrEqual(plan.days[1].tasks.length)
    expect(plan.days.reduce((total, day) => total + day.tasks.length, 0)).toBe(plan.tasks.length)
  })
})

describe('acompanhamento', () => {
  it('sem clientes em procura não há verificações', () => {
    expect(buildWeeklyPlan(input({})).health).toEqual([])
  })

  it('assinala quem está esquecido', () => {
    const forgotten = client('a', { lastContactAt: '2026-09-01', followUpAt: '', phone: '', wants: { ...emptyWants(), priority: 'morno' } })
    const fine = client('b')
    const health = Object.fromEntries(buildWeeklyPlan(input({ clients: [forgotten, fine] })).health.map((check) => [check.id, check]))
    expect(health.contacto).toMatchObject({ ok: 1, total: 2, level: 'atencao', clientIds: ['a'] })
    expect(health.proximo.clientIds).toEqual(['a'])
    expect(health.ficha.clientIds).toEqual(['a'])
  })
})
