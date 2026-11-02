import { describe, expect, it } from 'vitest'
import { computeMarketStats, estimatedPriceRange, normalPdf, pricePerM2, type Comparable } from './market-stats'

const comparable = (priceEur: number | null, areaM2: number | null, id = String(priceEur)): Comparable => ({ id, label: '', priceEur, areaM2, url: '' })

describe('market stats', () => {
  it('calcula preço por m² apenas com preço e área válidos', () => {
    expect(pricePerM2(comparable(300000, 100))).toBe(3000)
    expect(pricePerM2(comparable(null, 100))).toBeNull()
    expect(pricePerM2(comparable(300000, 0))).toBeNull()
    expect(pricePerM2(comparable(-1, 50))).toBeNull()
  })

  it('calcula média e desvio padrão amostral', () => {
    const stats = computeMarketStats([comparable(200000, 100, 'a'), comparable(300000, 100, 'b'), comparable(400000, 100, 'c')])
    expect(stats?.count).toBe(3)
    expect(stats?.meanPerM2).toBeCloseTo(3000)
    expect(stats?.sdPerM2).toBeCloseTo(1000)
    expect(stats?.lowPerM2).toBeCloseTo(2000)
    expect(stats?.highPerM2).toBeCloseTo(4000)
    expect(stats?.minPerM2).toBe(2000)
    expect(stats?.maxPerM2).toBe(4000)
  })

  it('ignora comparáveis inválidos e exige pelo menos dois válidos', () => {
    expect(computeMarketStats([comparable(200000, 100), comparable(null, 80)])).toBeNull()
    expect(computeMarketStats([])).toBeNull()
  })

  it('o limite inferior nunca fica abaixo de zero', () => {
    const stats = computeMarketStats([comparable(10000, 100, 'a'), comparable(900000, 100, 'b')])
    expect(stats?.lowPerM2).toBe(0)
  })

  it('estima o intervalo de preço pela área do imóvel', () => {
    const stats = computeMarketStats([comparable(200000, 100, 'a'), comparable(300000, 100, 'b'), comparable(400000, 100, 'c')])!
    const range = estimatedPriceRange(stats, 80)
    expect(range?.mean).toBeCloseTo(240000)
    expect(range?.low).toBeCloseTo(160000)
    expect(range?.high).toBeCloseTo(320000)
    expect(estimatedPriceRange(stats, null)).toBeNull()
  })

  it('a densidade normal tem o máximo na média', () => {
    expect(normalPdf(100, 100, 10)).toBeGreaterThan(normalPdf(110, 100, 10))
    expect(normalPdf(100, 100, 10)).toBeCloseTo(1 / (10 * Math.sqrt(2 * Math.PI)))
  })
})
