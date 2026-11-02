import { useState } from 'react'
import { formatEur, normalPdf, pricePerM2, type Comparable, type MarketStats } from '../lib/market-stats'
import './PriceDistributionChart.css'

type Props = {
  stats: MarketStats
  comparables: Comparable[]
  askingPerM2: number | null
}

const width = 560
const height = 250
const margin = { top: 40, right: 16, bottom: 34, left: 16 }
const plotWidth = width - margin.left - margin.right
const baseline = height - margin.bottom
const peakHeight = baseline - margin.top - 6
const curveSteps = 120

function niceTicks(min: number, max: number, count = 5) {
  const rawStep = (max - min) / (count - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rawStep) ?? rawStep
  const first = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let tick = first; tick <= max; tick += step) ticks.push(tick)
  return ticks
}

function compact(value: number) {
  return value >= 1000 ? `${(value / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })}K` : String(Math.round(value))
}

export default function PriceDistributionChart({ stats, comparables, askingPerM2 }: Props) {
  const [hovered, setHovered] = useState<{ id: string; x: number; y: number } | null>(null)

  // Com desvio padrão nulo (todos iguais) usa-se uma largura mínima só para desenhar a curva.
  const sd = stats.sdPerM2 > 0 ? stats.sdPerM2 : Math.max(stats.meanPerM2 * 0.05, 1)
  const points = comparables
    .map((comparable) => ({ comparable, value: pricePerM2(comparable) }))
    .filter((point): point is { comparable: Comparable; value: number } => point.value !== null)

  const candidates = [stats.meanPerM2 - 3.2 * sd, stats.meanPerM2 + 3.2 * sd, ...points.map((point) => point.value), ...(askingPerM2 === null ? [] : [askingPerM2])]
  const padding = sd * 0.4
  const domainMin = Math.max(0, Math.min(...candidates) - padding)
  const domainMax = Math.max(...candidates) + padding
  const x = (value: number) => margin.left + ((value - domainMin) / (domainMax - domainMin)) * plotWidth

  const peak = normalPdf(stats.meanPerM2, stats.meanPerM2, sd)
  const y = (density: number) => baseline - (density / peak) * peakHeight
  const curve = Array.from({ length: curveSteps + 1 }, (_, index) => {
    const value = domainMin + ((domainMax - domainMin) * index) / curveSteps
    return { value, px: x(value), py: y(normalPdf(value, stats.meanPerM2, sd)) }
  })
  const linePath = curve.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.px.toFixed(1)},${point.py.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${x(domainMax).toFixed(1)},${baseline} L${x(domainMin).toFixed(1)},${baseline} Z`

  const bandPoints = curve.filter((point) => point.value >= stats.lowPerM2 && point.value <= stats.highPerM2)
  const bandPath = bandPoints.length > 1
    ? `M${x(stats.lowPerM2).toFixed(1)},${baseline} L${x(stats.lowPerM2).toFixed(1)},${y(normalPdf(stats.lowPerM2, stats.meanPerM2, sd)).toFixed(1)} ${bandPoints.map((point) => `L${point.px.toFixed(1)},${point.py.toFixed(1)}`).join(' ')} L${x(stats.highPerM2).toFixed(1)},${y(normalPdf(stats.highPerM2, stats.meanPerM2, sd)).toFixed(1)} L${x(stats.highPerM2).toFixed(1)},${baseline} Z`
    : ''

  // Pontos próximos empilham-se para não se sobreporem.
  const sorted = [...points].sort((a, b) => a.value - b.value)
  const stacked = sorted.map((point, index) => {
    let row = 0
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      if (Math.abs(x(sorted[previous].value) - x(point.value)) < 11) row += 1
      else break
    }
    return { ...point, px: x(point.value), py: baseline - 9 - row * 11 }
  })

  const ticks = niceTicks(domainMin, domainMax, 8)
  const hoveredPoint = hovered ? stacked.find((point) => point.comparable.id === hovered.id) : undefined

  const meanX = x(stats.meanPerM2)
  const askingX = askingPerM2 === null ? null : x(askingPerM2)
  const askingAnchor = askingX !== null && askingX > width - 130 ? 'end' : 'start'
  const meanAnchor = meanX > width - 130 ? 'end' : 'start'

  return (
    <figure className="price-chart">
      <div className="price-chart-legend" aria-hidden="true">
        <span><i className="swatch-dot" /> Comparáveis ({stats.count})</span>
        <span><i className="swatch-curve" /> Distribuição normal ajustada</span>
        <span><i className="swatch-band" /> Média ± 1 desvio padrão</span>
        {askingPerM2 !== null && <span><i className="swatch-asking" /> Preço pedido</span>}
      </div>
      <div className="price-chart-frame">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Distribuição do preço por metro quadrado: média ${formatEur(stats.meanPerM2)}, desvio padrão ${formatEur(stats.sdPerM2)}, intervalo de ${formatEur(stats.lowPerM2)} a ${formatEur(stats.highPerM2)} por metro quadrado, com ${stats.count} comparáveis.`}>
          {ticks.map((tick) => <line className="grid" key={tick} x1={x(tick)} x2={x(tick)} y1={margin.top} y2={baseline} />)}
          <path className="area" d={areaPath} />
          {bandPath && <path className="band" d={bandPath} />}
          <path className="curve" d={linePath} />
          <line className="axis" x1={margin.left} x2={width - margin.right} y1={baseline} y2={baseline} />
          {ticks.map((tick) => <text className="tick" key={tick} x={x(tick)} y={baseline + 16} textAnchor="middle">{compact(tick)}</text>)}
          <text className="axis-title" x={width - margin.right} y={height - 4} textAnchor="end">€ por m²</text>

          <line className="mean-line" x1={meanX} x2={meanX} y1={margin.top - 8} y2={baseline} />
          <text className="label" x={meanX + (meanAnchor === 'start' ? 5 : -5)} y={12} textAnchor={meanAnchor}>Média {formatEur(stats.meanPerM2)}</text>

          {askingX !== null && askingPerM2 !== null && <>
            <line className="asking-line" x1={askingX} x2={askingX} y1={margin.top - 8} y2={baseline} />
            <text className="label" x={askingX + (askingAnchor === 'start' ? 5 : -5)} y={27} textAnchor={askingAnchor}>Pedido {formatEur(askingPerM2)}</text>
          </>}

          {stacked.map((point) => (
            <g key={point.comparable.id} onMouseEnter={() => setHovered({ id: point.comparable.id, x: point.px, y: point.py })} onMouseLeave={() => setHovered(null)}>
              <circle className="dot" cx={point.px} cy={point.py} r={4.5} />
              <circle className="dot-hit" cx={point.px} cy={point.py} r={10} />
            </g>
          ))}
        </svg>
        {hovered && hoveredPoint && (
          <div className="price-chart-tooltip" style={{ left: `${(hovered.x / width) * 100}%`, top: `${(hovered.y / height) * 100}%` }} role="status">
            <strong>{hoveredPoint.comparable.label || 'Comparável'}</strong>
            <span>{formatEur(hoveredPoint.value)}/m²</span>
            {hoveredPoint.comparable.priceEur !== null && hoveredPoint.comparable.areaM2 !== null && <small>{formatEur(hoveredPoint.comparable.priceEur)} · {hoveredPoint.comparable.areaM2} m²</small>}
          </div>
        )}
      </div>
    </figure>
  )
}
