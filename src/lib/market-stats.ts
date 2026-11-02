export type Comparable = {
  id: string
  label: string
  priceEur: number | null
  areaM2: number | null
  url: string
}

export type MarketStats = {
  count: number
  meanPerM2: number
  sdPerM2: number
  minPerM2: number
  maxPerM2: number
  lowPerM2: number
  highPerM2: number
}

export function pricePerM2(comparable: Pick<Comparable, 'priceEur' | 'areaM2'>) {
  const { priceEur, areaM2 } = comparable
  return priceEur !== null && areaM2 !== null && priceEur > 0 && areaM2 > 0 ? priceEur / areaM2 : null
}

// Média e desvio padrão amostral (n − 1) do preço por m² dos comparáveis válidos.
export function computeMarketStats(comparables: Comparable[]): MarketStats | null {
  const values = comparables.map(pricePerM2).filter((value): value is number => value !== null)
  if (values.length < 2) return null
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  const sd = Math.sqrt(variance)
  return {
    count: values.length,
    meanPerM2: mean,
    sdPerM2: sd,
    minPerM2: Math.min(...values),
    maxPerM2: Math.max(...values),
    lowPerM2: Math.max(0, mean - sd),
    highPerM2: mean + sd,
  }
}

export function estimatedPriceRange(stats: MarketStats, areaM2: number | null) {
  if (areaM2 === null || areaM2 <= 0) return null
  return {
    low: stats.lowPerM2 * areaM2,
    mean: stats.meanPerM2 * areaM2,
    high: stats.highPerM2 * areaM2,
  }
}

export function normalPdf(x: number, mean: number, sd: number) {
  const z = (x - mean) / sd
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI))
}

export function formatEur(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: fractionDigits }).format(value)
}
