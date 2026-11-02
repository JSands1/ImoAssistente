import { describe, expect, it } from 'vitest'
import { dayKey, defaultPricing, eventCostEur, summarize, type UsageEvent, type UserStat } from './admin-metrics'

const pricing = { inputPerM: 1, outputPerM: 4, eurPerUsd: 0.5 }
const now = new Date(2026, 9, 29, 15, 0)
const at = (day: number, hour = 10) => new Date(2026, 9, day, hour)

const event = (patch: Partial<UsageEvent> = {}): UsageEvent => ({ uid: 'u1', kind: 'report', model: 'm', inputTokens: 1_000_000, outputTokens: 500_000, ok: true, at: at(28), ...patch })
const stat = (patch: Partial<UserStat> = {}): UserStat => ({ uid: 'u1', email: 'a@x.pt', name: 'Ana', clients: 3, properties: 2, appointments: 1, lastSeenAt: at(29), ...patch })

describe('eventCostEur', () => {
  it('calcula tokens × preço por milhão × câmbio', () => {
    // (1M × $1 + 0,5M × $4) = $3 → €1,5
    expect(eventCostEur(event(), pricing)).toBeCloseTo(1.5)
    expect(eventCostEur({ inputTokens: 0, outputTokens: 0 }, pricing)).toBe(0)
  })

  it('tem preços por omissão positivos', () => {
    expect(defaultPricing.inputPerM).toBeGreaterThan(0)
    expect(defaultPricing.outputPerM).toBeGreaterThan(defaultPricing.inputPerM)
  })
})

describe('summarize', () => {
  it('soma chamadas, tokens e custo do período', () => {
    const summary = summarize([event(), event({ at: at(29, 9), kind: 'listing', inputTokens: 0, outputTokens: 1_000_000 })], [stat()], pricing, now, 7)
    expect(summary.calls).toBe(2)
    expect(summary.inputTokens).toBe(1_000_000)
    expect(summary.outputTokens).toBe(1_500_000)
    expect(summary.costEur).toBeCloseTo(1.5 + 2)
    expect(summary.projectedMonthEur).toBeCloseTo((3.5 / 7) * 30)
  })

  it('ignora eventos fora do período e do futuro', () => {
    const summary = summarize([event({ at: at(1) }), event({ at: new Date(2026, 9, 30) }), event()], [], pricing, now, 7)
    expect(summary.calls).toBe(1)
  })

  it('devolve um valor por dia, com zeros nos dias sem uso', () => {
    const summary = summarize([event({ at: at(27) })], [], pricing, now, 3)
    expect(summary.byDay.map((item) => item.day)).toEqual([dayKey(at(27)), dayKey(at(28)), dayKey(at(29))])
    expect(summary.byDay.map((item) => item.calls)).toEqual([1, 0, 0])
  })

  it('conta falhas sem as tirar das chamadas', () => {
    const summary = summarize([event({ ok: false, inputTokens: 0, outputTokens: 0 }), event()], [], pricing, now, 7)
    expect(summary.calls).toBe(2)
    expect(summary.failed).toBe(1)
  })

  it('agrupa por tipo de pedido, do mais caro para o mais barato', () => {
    const summary = summarize([event({ kind: 'market', inputTokens: 10, outputTokens: 0 }), event({ kind: 'report' })], [], pricing, now, 7)
    expect(summary.byKind.map((item) => item.kind)).toEqual(['report', 'market'])
  })

  it('junta o uso aos dados de cada utilizador e ordena por custo', () => {
    const summary = summarize(
      [event({ uid: 'u2' }), event({ uid: 'u2' }), event({ uid: 'u1', inputTokens: 1, outputTokens: 1 })],
      [stat({ uid: 'u1', email: 'a@x.pt' }), stat({ uid: 'u2', email: 'b@x.pt', clients: 10 })],
      pricing, now, 7,
    )
    expect(summary.byUser.map((user) => user.email)).toEqual(['b@x.pt', 'a@x.pt'])
    expect(summary.byUser[0].calls).toBe(2)
    expect(summary.byUser[0].clients).toBe(10)
  })

  it('mostra utilizadores sem ficha de estatísticas e utilizadores sem uso', () => {
    const summary = summarize([event({ uid: 'desconhecido' })], [stat({ uid: 'parado' })], pricing, now, 7)
    expect(summary.totalUsers).toBe(2)
    expect(summary.byUser.find((user) => user.uid === 'parado')?.calls).toBe(0)
    expect(summary.byUser.find((user) => user.uid === 'desconhecido')?.calls).toBe(1)
  })

  it('conta utilizadores ativos por uso ou por última visita no período', () => {
    const summary = summarize(
      [event({ uid: 'u1' })],
      [stat({ uid: 'u1' }), stat({ uid: 'u2', lastSeenAt: at(28) }), stat({ uid: 'u3', lastSeenAt: new Date(2026, 8, 1) }), stat({ uid: 'u4', lastSeenAt: null })],
      pricing, now, 7,
    )
    expect(summary.activeUsers).toBe(2)
    expect(summary.totalUsers).toBe(4)
    expect(summary.costPerActiveUserEur).toBeCloseTo(summary.costEur / 2)
  })

  it('soma clientes, imóveis e visitas de todas as contas', () => {
    const summary = summarize([], [stat({ uid: 'a', clients: 3, properties: 1, appointments: 2 }), stat({ uid: 'b', clients: 4, properties: 5, appointments: 0 })], pricing, now, 7)
    expect([summary.totalClients, summary.totalProperties, summary.totalAppointments]).toEqual([7, 6, 2])
  })

  it('sem dados devolve zeros sem dividir por zero', () => {
    const summary = summarize([], [], pricing, now, 30)
    expect(summary.costEur).toBe(0)
    expect(summary.costPerActiveUserEur).toBe(0)
    expect(summary.byDay).toHaveLength(30)
  })
})
