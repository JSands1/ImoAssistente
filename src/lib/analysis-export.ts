import { computeMarketStats, estimatedPriceRange, formatEur, pricePerM2 } from './market-stats'
import { detailRows, type PropertyWorkspace } from './property-ai'

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const levelLabel: Record<string, string> = { alto: 'Alto', medio: 'Médio', baixo: 'Baixo' }

function list(items: string[]) {
  return items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''
}

function paragraphs(text: string) {
  return text.split(/\n{2,}/).map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('')
}

function safeHref(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

export function hasAnalysisContent(workspace: PropertyWorkspace) {
  return Boolean(workspace.report || workspace.listing || workspace.market?.comparables.length)
}

const pageStyle = `
  body { max-width: 820px; margin: 32px auto; padding: 0 20px; color: #1c1b19; font: 14px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  h1 { margin: 0 0 4px; font-size: 24px; } h2 { margin: 30px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #d9d5cc; font-size: 17px; }
  h3 { margin: 18px 0 4px; font-size: 14px; } p { margin: 6px 0; } ul { margin: 4px 0 8px; padding-left: 20px; }
  .meta { color: #6b665c; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e6e2d9; text-align: left; vertical-align: top; }
  th { color: #6b665c; font-weight: 600; font-size: 12px; }
  .kv th { width: 34%; }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
  .stats div { flex: 1 1 150px; padding: 8px 10px; border: 1px solid #e0dcd2; }
  .stats small { display: block; color: #6b665c; font-size: 11px; } .stats strong { font-size: 14px; }
  .chart { margin: 12px 0; padding: 14px; background: #101112; }
  .tag { display: inline-block; margin-left: 6px; padding: 1px 6px; border: 1px solid #c9c4b8; color: #6b665c; font-size: 11px; }
  .note { margin-top: 28px; padding-top: 10px; border-top: 1px solid #d9d5cc; color: #6b665c; font-size: 12px; }
  @media print { body { margin: 0; max-width: none; } h2 { break-after: avoid; } .chart, tr, .suggestion { break-inside: avoid; } }
`

// Documento HTML autónomo (sem dependências), pronto a guardar ou a imprimir em PDF.
export async function buildAnalysisHtml(input: { reference: string; title: string; workspace: PropertyWorkspace }) {
  const { details, market, report, listing } = input.workspace
  const comparables = market?.comparables ?? []
  const stats = computeMarketStats(comparables)
  const askingPerM2 = pricePerM2({ priceEur: details.askingPriceEur, areaM2: details.usefulAreaM2 })
  const sections: string[] = []

  const rows = detailRows(details)
  if (rows.length) {
    sections.push(`<h2>Características do imóvel</h2><table class="kv">${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table>`)
  }

  if (market && comparables.length) {
    let marketHtml = `<h2>Preços da zona</h2><p class="meta">Obtidos por pesquisa automática na web em ${escapeHtml(new Date(market.fetchedAt).toLocaleString('pt-PT'))}. Não verificados; preços de anúncio não são preços de venda.</p>`
    if (stats) {
      const range = estimatedPriceRange(stats, details.usefulAreaM2)
      const cells: Array<[string, string]> = [
        ['Anúncios válidos', String(stats.count)],
        ['Média', `${formatEur(stats.meanPerM2)}/m²`],
        ['Desvio padrão', `${formatEur(stats.sdPerM2)}/m²`],
        ['Intervalo ± 1 desvio padrão', `${formatEur(stats.lowPerM2)} – ${formatEur(stats.highPerM2)}/m²`],
      ]
      if (range) cells.push([`Para ${details.usefulAreaM2} m²`, `${formatEur(range.low)} – ${formatEur(range.high)}`])
      if (askingPerM2 !== null) cells.push(['Preço pedido', `${formatEur(askingPerM2)}/m²`])
      marketHtml += `<div class="stats">${cells.map(([label, value]) => `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>`
      if (stats.count < 5) marketHtml += `<p class="meta">Poucos anúncios válidos: o desvio padrão e a curva são pouco fiáveis.</p>`

      // O gráfico é o mesmo da página, desenhado em SVG estático.
      const [{ renderToStaticMarkup }, { createElement }, chartModule, cssModule] = await Promise.all([
        import('react-dom/server'),
        import('react'),
        import('../components/PriceDistributionChart'),
        import('../components/PriceDistributionChart.css?inline'),
      ])
      const chart = renderToStaticMarkup(createElement(chartModule.default, { stats, comparables, askingPerM2 }))
      marketHtml += `<style>${cssModule.default}</style><div class="chart">${chart}</div>`
    }
    marketHtml += `<table><tr><th>Anúncio</th><th>Preço</th><th>Área</th><th>€/m²</th><th>Fonte</th></tr>${comparables.map((comparable) => {
      const href = safeHref(comparable.url)
      const perM2 = pricePerM2(comparable)
      return `<tr><td>${escapeHtml(comparable.label || 'Anúncio')}</td><td>${comparable.priceEur === null ? '—' : escapeHtml(formatEur(comparable.priceEur))}</td><td>${comparable.areaM2 === null ? '—' : `${comparable.areaM2} m²`}</td><td>${perM2 === null ? '—' : escapeHtml(formatEur(perM2))}</td><td>${href ? `<a href="${escapeHtml(href)}">${escapeHtml(new URL(href).hostname.replace(/^www\./, ''))}</a>` : '—'}</td></tr>`
    }).join('')}</table>`
    sections.push(marketHtml)
  }

  if (report) {
    let reportHtml = `<h2>Análise por IA</h2><p>${escapeHtml(report.summary)}${report.typology ? ` <strong>Tipologia sugerida: ${escapeHtml(report.typology)}</strong>` : ''}</p>`
    if (report.strengths.length) reportHtml += `<h3>Vantagens</h3>${list(report.strengths)}`
    if (report.weaknesses.length) reportHtml += `<h3>Desvantagens</h3>${list(report.weaknesses)}`
    if (report.valueSuggestions.length) {
      reportHtml += `<h3>Sugestões para valorizar o imóvel</h3>${report.valueSuggestions.map((suggestion) => `<div class="suggestion"><p><strong>${escapeHtml(suggestion.action)}</strong><span class="tag">Impacto ${levelLabel[suggestion.impact]}</span><span class="tag">Esforço ${levelLabel[suggestion.effort]}</span></p>${suggestion.rationale ? `<p class="meta">${escapeHtml(suggestion.rationale)}</p>` : ''}</div>`).join('')}`
    }
    if (report.layoutObservations.length) reportHtml += `<h3>Distribuição</h3>${list(report.layoutObservations)}`
    if (report.possibleMissedRooms.length) reportHtml += `<h3>Divisões visíveis na planta e não indicadas</h3>${list(report.possibleMissedRooms)}`
    if (report.missingInfo.length) reportHtml += `<h3>Informação em falta que melhoraria a análise</h3>${list(report.missingInfo)}`
    if (report.caveats.length) reportHtml += `<h3>Limitações</h3>${list(report.caveats)}`
    reportHtml += `<p class="meta">Gerado por IA em ${escapeHtml(new Date(report.generatedAt).toLocaleString('pt-PT'))}. Requer revisão do consultor.</p>`
    sections.push(reportHtml)
  }

  if (listing) {
    sections.push(`<h2>Descritivo para o anúncio</h2><h3>${escapeHtml(listing.title)}</h3>${paragraphs(listing.description)}${listing.highlights.length ? `<h3>Destaques</h3>${list(listing.highlights)}` : ''}<p class="meta">Gerado por IA em ${escapeHtml(new Date(listing.generatedAt).toLocaleString('pt-PT'))}. Confirma que todos os factos estão corretos antes de publicar.</p>`)
  }

  const heading = [input.reference, input.title].filter(Boolean).join(' · ') || 'Imóvel'
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Análise do imóvel · ${escapeHtml(heading)}</title><style>${pageStyle}</style></head><body><h1>Análise do imóvel</h1><p class="meta">${escapeHtml(heading)} · exportado em ${escapeHtml(new Date().toLocaleString('pt-PT'))}</p>${sections.join('')}<p class="note">Estimativas indicativas geradas com apoio de IA e dados não verificados. Não constituem uma avaliação oficial do imóvel.</p></body></html>`
}

export function downloadHtml(fileName: string, html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportFileName(reference: string) {
  const slug = reference.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'imovel'
  return `analise-${slug}-${new Date().toISOString().slice(0, 10)}.html`
}
