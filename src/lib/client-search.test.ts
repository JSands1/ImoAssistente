import { describe, expect, it } from 'vitest'
import { applyProfilePatch, buildSearchProfile, emptyExtras, migrateSearchProfiles, parseExtras } from './client-search'
import { emptyWants, newClient, type HistoryClient } from './history'
import { matchClients } from './matching'
import { emptyProfile, type SearchProfile } from './portal-links'

function client(overrides: Partial<HistoryClient> & { id: string }): HistoryClient {
  return { ...newClient('2026-01-01'), ...overrides }
}

const ines = client({
  id: 'ines',
  name: 'Inês Carvalho',
  phone: '912 345 678',
  wants: { ...emptyWants(), propertyTypes: ['apartamento'], typologies: ['T2'], district: 'lisboa', municipality: 'Torres Vedras', otherZones: 'Mafra, Lourinhã', budgetMin: 180000, budgetMax: 250000, features: ['elevador', 'garagem'] },
})

describe('buildSearchProfile', () => {
  it('preenche a procura a partir da ficha do cliente', () => {
    expect(buildSearchProfile(ines)).toMatchObject({
      id: 'ines', name: 'Inês Carvalho', phone: '912 345 678', propertyType: 'apartamento', typology: 'T2',
      district: 'lisboa', municipality: 'Torres Vedras', budgetMin: 180000, budgetMax: 250000, features: ['elevador', 'garagem'],
      areaMin: null, areaMax: null, condition: '', preferences: '',
    })
  })

  it('junta os extras guardados para esse cliente', () => {
    const profile = buildSearchProfile(ines, { areaMin: 60, areaMax: 90, condition: 'usado', preferences: 'perto da escola' })
    expect(profile).toMatchObject({ areaMin: 60, areaMax: 90, condition: 'usado', preferences: 'perto da escola', municipality: 'Torres Vedras' })
  })

  it('trata tipos e tipologias que os portais não cobrem', () => {
    const terreno = buildSearchProfile(client({ id: 'x', wants: { ...emptyWants(), propertyTypes: ['terreno'], typologies: ['T6+'] } }))
    expect(terreno).toMatchObject({ propertyType: 'apartamento', typology: '', district: '', municipality: '' })
    expect(buildSearchProfile(client({ id: 'y', wants: { ...emptyWants(), propertyTypes: ['moradia'] } })).propertyType).toBe('moradia')
    expect(buildSearchProfile(client({ id: 'z', wants: { ...emptyWants(), propertyTypes: ['apartamento', 'moradia'] } })).propertyType).toBe('apartamento')
  })
})

describe('applyProfilePatch', () => {
  it('os critérios alterados na procura atualizam a ficha do cliente', () => {
    const { client: next, extras } = applyProfilePatch(ines, emptyExtras, { municipality: 'Mafra', budgetMax: 300000, typology: 'T3', features: ['piscina'], propertyType: 'moradia', district: 'lisboa', budgetMin: null })
    expect(next.wants).toMatchObject({ municipality: 'Mafra', budgetMax: 300000, budgetMin: null, typologies: ['T3'], features: ['piscina'], propertyTypes: ['moradia'], otherZones: 'Mafra, Lourinhã' })
    expect(extras).toEqual(emptyExtras)
    expect(next.name).toBe('Inês Carvalho')
  })

  it('o nome e o telefone também vão para a ficha', () => {
    const { client: next } = applyProfilePatch(ines, emptyExtras, { name: 'Inês C.', phone: '913 000 000' })
    expect(next).toMatchObject({ name: 'Inês C.', phone: '913 000 000' })
  })

  it('a área, o estado e as preferências ficam só nos extras', () => {
    const { client: next, extras } = applyProfilePatch(ines, emptyExtras, { areaMin: 70, areaMax: null, condition: 'novo', preferences: 'varanda grande' })
    expect(extras).toEqual({ areaMin: 70, areaMax: null, condition: 'novo', preferences: 'varanda grande' })
    expect(next.wants).toEqual(ines.wants)
  })

  it('não altera os objetos de origem', () => {
    const before = JSON.stringify(ines)
    applyProfilePatch(ines, emptyExtras, { municipality: 'Outro', features: [] })
    expect(JSON.stringify(ines)).toBe(before)
  })
})

describe('parseExtras', () => {
  it('lê extras válidos e corrige o resto', () => {
    expect(parseExtras({ a: { areaMin: 50, areaMax: -1, condition: 'usado', preferences: 'x' }, b: 'lixo', c: { condition: 'ruína' } })).toEqual({
      a: { areaMin: 50, areaMax: null, condition: 'usado', preferences: 'x' },
      c: { areaMin: null, areaMax: null, condition: '', preferences: '' },
    })
    expect(parseExtras(null)).toEqual({})
    expect(parseExtras([1, 2])).toEqual({})
  })
})

describe('migrateSearchProfiles', () => {
  const sample: SearchProfile = { ...emptyProfile('sample'), name: 'João', typology: 'T2', municipality: 'Torres Vedras', budgetMax: 250000 }
  const real: SearchProfile = { ...emptyProfile('real'), name: 'Rui Pires', phone: '961 000 111', propertyType: 'moradia', typology: 'T3', district: 'setubal', municipality: 'Palmela', budgetMax: 400000, features: ['jardim'], areaMin: 120, preferences: 'perto do comboio' }
  const doCliente: SearchProfile = { ...emptyProfile('ines'), name: 'Inês Carvalho', municipality: 'Torres Vedras', areaMin: 60, condition: 'usado' }

  it('descarta o perfil de exemplo antigo', () => {
    expect(migrateSearchProfiles([sample], [])).toEqual({ clients: [], extras: {}, created: 0 })
  })

  it('transforma perfis independentes em clientes da carteira, mantendo o id e os extras', () => {
    const { clients, extras, created } = migrateSearchProfiles([real], [])
    expect(created).toBe(1)
    expect(clients[0]).toMatchObject({ id: 'real', name: 'Rui Pires', phone: '961 000 111', status: 'procura' })
    expect(clients[0].wants).toMatchObject({ propertyTypes: ['moradia'], typologies: ['T3'], district: 'setubal', municipality: 'Palmela', budgetMax: 400000, features: ['jardim'] })
    expect(extras.real).toEqual({ areaMin: 120, areaMax: null, condition: '', preferences: 'perto do comboio' })
  })

  it('perfis de clientes que já existem só trazem os extras', () => {
    const { clients, extras, created } = migrateSearchProfiles([doCliente], [ines])
    expect(created).toBe(0)
    expect(clients).toEqual([ines])
    expect(extras.ines).toEqual({ areaMin: 60, areaMax: null, condition: 'usado', preferences: '' })
  })

  it('ignora perfis vazios', () => {
    expect(migrateSearchProfiles([emptyProfile('vazio')], []).created).toBe(0)
  })
})

describe('matchClients', () => {
  const base = { zone: 'Torres Vedras', typology: 'T2', price: 240000 }
  const bruno = client({ id: 'bruno', name: 'Bruno', wants: { ...emptyWants(), typologies: ['T1'], municipality: 'Porto', budgetMax: 150000 } })
  const carla = client({ id: 'carla', name: 'Carla', wants: { ...emptyWants(), typologies: ['T3'], municipality: 'Torres Vedras', budgetMax: 400000 } })
  const semZona = client({ id: 'sz', name: 'Sem Zona', wants: { ...emptyWants(), typologies: ['T2'], budgetMax: 260000 } })
  const comprou = client({ id: 'c', name: 'Já comprou', status: 'comprou', wants: ines.wants })

  it('encaixa quando a zona, a tipologia e o orçamento batem (100%)', () => {
    expect(matchClients(base, [ines])).toEqual([{ client: ines, score: 100 }])
  })

  it('aceita a zona noutras zonas aceites e sem acentos', () => {
    const mafra = client({ id: 'm', name: 'M', wants: { ...ines.wants, municipality: 'Sintra', otherZones: 'Torres Védras' } })
    expect(matchClients(base, [mafra])[0].score).toBe(100)
  })

  it('exclui clientes de outra zona, mesmo que o resto encaixe', () => {
    expect(matchClients(base, [bruno])).toEqual([])
  })

  it('tipologia diferente com zona e orçamento certos ainda não chega (70%)', () => {
    expect(matchClients(base, [carla])).toEqual([{ client: carla, score: 70 }])
  })

  it('um orçamento até 10% acima conta metade', () => {
    expect(matchClients({ ...base, price: 270000 }, [ines])[0].score).toBe(85)
    expect(matchClients({ ...base, price: 300000 }, [ines])).toEqual([{ client: ines, score: 70 }])
  })

  it('sem zona definida exige tipologia e orçamento', () => {
    expect(matchClients(base, [semZona])).toEqual([{ client: semZona, score: 60 }])
    expect(matchClients({ ...base, typology: 'T3' }, [semZona])).toEqual([])
  })

  it('só considera clientes ainda à procura e ordena por pontuação', () => {
    const resultado = matchClients(base, [comprou, carla, ines, semZona])
    expect(resultado.map((m) => m.client.id)).toEqual(['ines', 'carla', 'sz'])
  })

  it('T4+ nos imóveis cobre T4, T5 e T6+', () => {
    const quatro = client({ id: 'q', name: 'Q', wants: { ...emptyWants(), typologies: ['T5'], municipality: 'Torres Vedras', budgetMax: 500000 } })
    expect(matchClients({ zone: 'Torres Vedras', typology: 'T4+', price: 450000 }, [quatro])[0].score).toBe(100)
  })

  it('respeita o limite', () => {
    const muitos = Array.from({ length: 6 }, (_, i) => client({ id: `k${i}`, name: `Cliente ${i}`, wants: ines.wants }))
    expect(matchClients(base, muitos)).toHaveLength(3)
    expect(matchClients(base, muitos, 5)).toHaveLength(5)
  })
})

describe('várias tipologias', () => {
  const dois = client({ id: 'dois', name: 'Dois', wants: { ...emptyWants(), typologies: ['T2', 'T3'], municipality: 'Torres Vedras', budgetMax: 300000 } })

  it('a procura usa a primeira tipologia que os portais cobrem', () => {
    expect(buildSearchProfile(dois).typology).toBe('T2')
  })

  it('o imóvel encaixa se coincidir com qualquer uma delas', () => {
    expect(matchClients({ zone: 'Torres Vedras', typology: 'T3', price: 250000 }, [dois])[0]?.score).toBe(100)
    expect(matchClients({ zone: 'Torres Vedras', typology: 'T1', price: 250000 }, [dois])[0]?.score).toBe(70)
  })

  it('mudar na procura para uma tipologia já aceite não mexe na ficha', () => {
    expect(applyProfilePatch(dois, emptyExtras, { typology: 'T3' }).client.wants.typologies).toEqual(['T2', 'T3'])
    expect(applyProfilePatch(dois, emptyExtras, { typology: 'T4' }).client.wants.typologies).toEqual(['T4'])
    expect(applyProfilePatch(dois, emptyExtras, { typology: '' }).client.wants.typologies).toEqual([])
  })
})
