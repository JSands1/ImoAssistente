import { describe, expect, it } from 'vitest'
import { buildAnalysisHtml, escapeHtml, exportFileName, hasAnalysisContent } from './analysis-export'
import { emptyPropertyDetails, parseWorkspace, type PropertyWorkspace } from './property-ai'

const emptyWorkspace = parseWorkspace({})

const sampleWorkspace: PropertyWorkspace = {
  details: { ...emptyPropertyDetails, location: 'Matosinhos', typology: 'T3', usefulAreaM2: 98, energyClass: 'D', askingPriceEur: 340000 },
  market: {
    fetchedAt: '2026-10-22T10:00:00Z',
    comparables: [
      { id: 'a', label: 'T3 Rua A', priceEur: 300000, areaM2: 100, url: 'https://exemplo.pt/a' },
      { id: 'b', label: 'T3 Rua B', priceEur: 320000, areaM2: 95, url: 'javascript:alert(1)' },
      { id: 'c', label: 'T3 Rua C', priceEur: 280000, areaM2: 90, url: 'https://exemplo.pt/c' },
    ],
  },
  report: {
    summary: 'Resumo <script>alert(1)</script>',
    typology: 'T3',
    layoutObservations: [],
    strengths: ['Garagem'],
    weaknesses: ['Classe D'],
    valueSuggestions: [{ action: 'Pintar', impact: 'medio', effort: 'baixo', rationale: 'Mais luz' }],
    missingInfo: [],
    possibleMissedRooms: [],
    caveats: [],
    source: 'INFERRED',
    generatedAt: '2026-10-22T10:00:00Z',
  },
  listing: { title: 'T3 "premium" & luminoso', description: 'Primeiro parágrafo.\n\nSegundo parágrafo.', highlights: ['Garagem'], tone: 'profissional', generatedAt: '2026-10-22T10:00:00Z' },
}

describe('escapeHtml', () => {
  it('escapa caracteres especiais', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })
})

describe('hasAnalysisContent', () => {
  it('só é verdadeiro quando há análise, descritivo ou preços', () => {
    expect(hasAnalysisContent(emptyWorkspace)).toBe(false)
    expect(hasAnalysisContent({ ...emptyWorkspace, details: sampleWorkspace.details })).toBe(false)
    expect(hasAnalysisContent(sampleWorkspace)).toBe(true)
  })
})

describe('buildAnalysisHtml', () => {
  it('cria um documento completo e não deixa passar HTML do texto gerado pela IA', async () => {
    const html = await buildAnalysisHtml({ reference: 'CN-001', title: 'T3 <Matosinhos>', workspace: sampleWorkspace })
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('Matosinhos')
    expect(html).toContain('Garagem')
    expect(html).toContain('Primeiro parágrafo.')
    expect(html).toContain('<svg')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('T3 &lt;Matosinhos&gt;')
  })

  it('funciona só com o descritivo, sem preços nem gráfico', async () => {
    const html = await buildAnalysisHtml({ reference: 'CN-002', title: '', workspace: { ...emptyWorkspace, listing: sampleWorkspace.listing } })
    expect(html).toContain('Descritivo para o anúncio')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('Preços da zona')
  })
})

describe('exportFileName', () => {
  it('gera um nome de ficheiro seguro', () => {
    expect(exportFileName('CN-001 / Ação')).toMatch(/^analise-cn-001-acao-\d{4}-\d{2}-\d{2}\.html$/)
    expect(exportFileName('')).toMatch(/^analise-imovel-/)
  })
})
