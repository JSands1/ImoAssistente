import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildContext, emptyPropertyDetails, extractJson, loadWorkspace, marketQuery, parseWorkspace, sanitizeComparables, saveWorkspace } from './property-ai'
import { computeMarketStats } from './market-stats'

describe('persistência entre visitas', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubStorage(initial: Record<string, string> = {}) {
    const store = new Map(Object.entries(initial))
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
    })
    return store
  }

  it('guarda só as características e não a análise gerada', () => {
    const store = stubStorage()
    const workspace = parseWorkspace({
      details: { location: 'Torres Vedras' },
      report: { summary: 'x', source: 'INFERRED', generatedAt: '2026-10-23T10:00:00Z' },
      listing: { title: 't', description: 'd', highlights: [], tone: 'conciso', generatedAt: '2026-10-23T10:00:00Z' },
      market: { comparables: [], fetchedAt: '2026-10-23T10:00:00Z' },
    })
    expect(workspace.report).not.toBeNull()
    saveWorkspace('p1', workspace)
    const raw = JSON.parse(store.get('casanexa-property-analysis') ?? '{}') as Record<string, Record<string, unknown>>
    expect(Object.keys(raw.p1)).toEqual(['details'])
    const loaded = loadWorkspace('p1')
    expect(loaded.details.location).toBe('Torres Vedras')
    expect(loaded.report).toBeNull()
    expect(loaded.listing).toBeNull()
    expect(loaded.market).toBeNull()
  })

  it('ignora análises que versões anteriores tinham guardado', () => {
    stubStorage({
      'casanexa-property-analysis': JSON.stringify({
        p1: { details: { location: 'Porto' }, report: { summary: 'antigo', source: 'INFERRED', generatedAt: '2026-10-01T10:00:00Z' } },
      }),
    })
    const loaded = loadWorkspace('p1')
    expect(loaded.details.location).toBe('Porto')
    expect(loaded.report).toBeNull()
  })
})

describe('parseWorkspace', () => {
  it('devolve uma ficha vazia quando não há nada guardado', () => {
    for (const raw of [undefined, null, {}, 'lixo', 42, []]) {
      const workspace = parseWorkspace(raw)
      expect(workspace.details).toEqual(emptyPropertyDetails)
      expect(workspace.market).toBeNull()
      expect(workspace.report).toBeNull()
      expect(workspace.listing).toBeNull()
    }
  })

  it('mantém os valores válidos e corrige os inválidos', () => {
    const workspace = parseWorkspace({
      details: { location: 'Porto', usefulAreaM2: -5, constructionYear: 1990, energyClass: 'C' },
      market: { comparables: [{ id: 'a', label: 'T2', priceEur: 200000, areaM2: 80, url: 'https://exemplo.pt/a' }, 'lixo'], fetchedAt: '2026-10-22T10:00:00Z' },
      report: { summary: 'incompleto' },
      listing: { title: 'Título', description: 'Texto', highlights: ['a'], tone: 'conciso', generatedAt: '2026-10-22T10:00:00Z' },
    })
    expect(workspace.details.location).toBe('Porto')
    expect(workspace.details.usefulAreaM2).toBeNull()
    expect(workspace.details.constructionYear).toBe(1990)
    expect(workspace.market?.comparables).toHaveLength(1)
    expect(workspace.report).toBeNull()
    expect(workspace.listing?.title).toBe('Título')
  })

  it('ignora dados antigos com comparáveis introduzidos à mão', () => {
    const workspace = parseWorkspace({ details: {}, comparables: [{ id: 'x', label: '', priceEur: 1, areaM2: 1, url: '' }] })
    expect(workspace.market).toBeNull()
  })
})

describe('extractJson', () => {
  it('lê JSON puro, em bloco de código ou com texto à volta', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('Aqui está o resultado:\n{"a":1}\nEspero que ajude.')).toEqual({ a: 1 })
  })

  it('falha quando não há JSON', () => {
    expect(() => extractJson('sem dados')).toThrow()
  })
})

describe('sanitizeComparables', () => {
  const valid = { label: 'T3 Rua X', priceEur: 300000, areaM2: 100, url: 'https://exemplo.pt/a' }

  it('aceita itens completos e plausíveis', () => {
    const result = sanitizeComparables({ comparables: [valid] })
    expect(result).toHaveLength(1)
    expect(result[0].priceEur).toBe(300000)
  })

  it('descarta itens sem ligação válida, repetidos ou com valores implausíveis', () => {
    const result = sanitizeComparables({
      comparables: [
        valid,
        { ...valid },
        { ...valid, url: 'javascript:alert(1)' },
        { ...valid, url: 'não é url' },
        { ...valid, url: 'https://exemplo.pt/b', priceEur: 50 },
        { ...valid, url: 'https://exemplo.pt/c', areaM2: 0.5 },
        { ...valid, url: 'https://exemplo.pt/d', priceEur: 900000, areaM2: 20 },
        { label: 'sem preço', areaM2: 80, url: 'https://exemplo.pt/e' },
      ],
    })
    expect(result.map((item) => item.url)).toEqual(['https://exemplo.pt/a'])
  })

  it('devolve lista vazia perante respostas inesperadas', () => {
    expect(sanitizeComparables(null)).toEqual([])
    expect(sanitizeComparables({})).toEqual([])
    expect(sanitizeComparables({ comparables: 'x' })).toEqual([])
  })
})

describe('buildContext e marketQuery', () => {
  it('ignora campos vazios e inclui as estatísticas dos preços da zona', () => {
    const comparables = [
      { id: 'a', label: '', priceEur: 200000, areaM2: 100, url: '' },
      { id: 'b', label: '', priceEur: 300000, areaM2: 100, url: '' },
    ]
    const context = buildContext({ ...emptyPropertyDetails, location: 'Matosinhos', usefulAreaM2: 90 }, computeMarketStats(comparables), comparables)
    expect(context).toContain('Localização: Matosinhos')
    expect(context).not.toContain('Ano de construção')
    expect(context).toContain('Preço médio')
    expect(context).toContain('poucos comparáveis')
  })

  it('a pesquisa de mercado não envia preço pedido nem notas', () => {
    const query = marketQuery({ ...emptyPropertyDetails, location: 'Porto', typology: 'T2', askingPriceEur: 250000, notes: 'privado' })
    expect(query).toContain('Localização: Porto')
    expect(query).toContain('Tipologia: T2')
    expect(query).not.toContain('250')
    expect(query).not.toContain('privado')
  })
})
