import { describe, expect, it } from 'vitest'
import { emptyPropertyDetails, type PropertyWorkspace } from './property-ai'
import { maxSavedAnalyses, parseSavedAnalyses, recordAnalysis, removeSavedAnalysis, type SavedAnalysis } from './analysis-history'

const report = { summary: 'Boa luz', typology: 'T2', layoutObservations: [], strengths: [], weaknesses: [], valueSuggestions: [], missingInfo: [], possibleMissedRooms: [], caveats: [], source: 'INFERRED' as const, generatedAt: '2026-10-28T10:00:00Z' }
const listing = { title: 'T2 luminoso', description: 'Texto', highlights: [], tone: 'profissional', generatedAt: '2026-10-28T10:05:00Z' }
const workspace = (patch: Partial<PropertyWorkspace>): PropertyWorkspace => ({ details: { ...emptyPropertyDetails, location: 'Porto' }, market: null, report: null, listing: null, ...patch })
const input = (patch: Partial<PropertyWorkspace>, propertyId = 'p1', savedAt = '2026-10-28T10:00:00Z') => ({ propertyId, reference: 'CN-1', title: 'T2', savedAt, workspace: workspace(patch) })

describe('recordAnalysis', () => {
  it('a primeira análise cria uma entrada', () => {
    const { list, id } = recordAnalysis([], '', 'report', input({ report }), 'n1')
    expect(id).toBe('n1')
    expect(list.map((item) => item.id)).toEqual(['n1'])
    expect(list[0].report?.summary).toBe('Boa luz')
  })

  it('o descritivo junta-se à entrada aberta', () => {
    const first = recordAnalysis([], '', 'report', input({ report }), 'n1')
    const second = recordAnalysis(first.list, first.id, 'listing', input({ report, listing }), 'n2')
    expect(second.id).toBe('n1')
    expect(second.list).toHaveLength(1)
    expect(second.list[0].listing?.title).toBe('T2 luminoso')
  })

  it('gerar outra análise cria uma entrada nova e a mais recente fica primeiro', () => {
    const first = recordAnalysis([], '', 'report', input({ report }), 'n1')
    const second = recordAnalysis(first.list, first.id, 'report', input({ report: { ...report, summary: 'Segunda' } }, 'p1', '2026-10-29T10:00:00Z'), 'n2')
    expect(second.list.map((item) => item.id)).toEqual(['n2', 'n1'])
    expect(second.list[1].report?.summary).toBe('Boa luz')
  })

  it('a entrada aberta de outro imóvel não é alterada', () => {
    const first = recordAnalysis([], '', 'report', input({ report }, 'p1'), 'n1')
    const other = recordAnalysis(first.list, first.id, 'listing', input({ listing }, 'p2'), 'n2')
    expect(other.list.map((item) => item.id)).toEqual(['n2', 'n1'])
  })

  it('não passa do limite', () => {
    const many: SavedAnalysis[] = Array.from({ length: maxSavedAnalyses }, (_, index) => ({ id: `x${index}`, propertyId: 'p1', reference: '', title: '', savedAt: '', details: emptyPropertyDetails, report, listing: null }))
    expect(recordAnalysis(many, '', 'report', input({ report }), 'novo').list).toHaveLength(maxSavedAnalyses)
  })
})

describe('parseSavedAnalyses', () => {
  it('descarta o que está corrompido ou vazio e mantém o resto', () => {
    const valid = { id: 'a', propertyId: 'p1', savedAt: '2026-10-28T10:00:00Z', details: { location: 'Porto' }, report, listing: null }
    expect(parseSavedAnalyses([valid, { id: '' }, 'lixo', { ...valid, id: 'b', report: null, listing: null }]).map((item) => item.id)).toEqual(['a'])
    expect(parseSavedAnalyses('lixo')).toEqual([])
  })

  it('remover tira só a escolhida', () => {
    const a = recordAnalysis([], '', 'report', input({ report }), 'a')
    expect(removeSavedAnalysis(a.list, 'a')).toEqual([])
  })
})
