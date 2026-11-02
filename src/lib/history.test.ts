import { describe, expect, it } from 'vitest'
import {
  buildContactMessage,
  contactSubject,
  describePurchase,
  describePurchaseWindow,
  describeWants,
  emptyPortfolioFilters,
  emptyWants,
  filterPortfolio,
  hasActivePortfolioFilters,
  portfolioStats,
  sortPortfolio,
  emptyFilters,
  filterClients,
  formatDate,
  hasActiveFilters,
  isEmail,
  mailtoUrl,
  mergeClients,
  migrateLegacyClients,
  monthYear,
  newClient,
  newPurchase,
  newVisit,
  parseBackup,
  parseHistory,
  timeSince,
  purchaseWindow,
  serializeBackup,
  sortClients,
  todayIso,
  visitStats,
  type HistoryClient,
} from './history'

function client(overrides: Partial<HistoryClient> & { id: string }): HistoryClient {
  return { ...newClient('2026-01-10'), ...overrides }
}

const joao = client({
  id: 'joao',
  name: 'João Martins',
  phone: '912345678',
  email: 'joao@exemplo.pt',
  startedAt: '2026-01-10',
  status: 'comprou',
  learned: 'Procurava T2 com elevador e garagem perto da escola',
  visits: [
    { ...newVisit('2026-02-01'), property: 'T2 Rua A', interest: 'talvez', notes: 'Cozinha pequena' },
    { ...newVisit('2026-03-15'), property: 'T2 Rua B', interest: 'gostou', notes: 'Boa luz, sem garagem' },
    { ...newVisit('2026-04-20'), property: 'T3 Rua C', interest: 'gostou', notes: '' },
  ],
  purchase: { ...newPurchase('2026-05-10'), propertyType: 'apartamento', typology: 'T2', location: 'Torres Vedras', priceEur: 240000, areaM2: 80, description: 'T2 remodelado com garagem' },
})
const maria = client({
  id: 'maria',
  name: 'Maria Sá',
  email: 'maria@exemplo.pt',
  startedAt: '2026-02-20',
  status: 'comprou',
  purchase: { ...newPurchase('2025-11-30'), propertyType: 'moradia', typology: 'T3', location: 'Mafra', priceEur: 420000, description: 'Moradia com jardim' },
})
const rui = client({ id: 'rui', name: 'Rui Évora', startedAt: '2026-06-01', status: 'procura', visits: [{ ...newVisit('2026-06-10'), property: 'Moradia em Sintra', notes: 'Precisa de obras' }] })
const ana = client({ id: 'ana', name: 'Ana Dias', startedAt: '2025-12-01', status: 'desistiu' })
const all = [joao, maria, rui, ana]
const ids = (list: HistoryClient[]) => list.map((item) => item.id)

describe('datas', () => {
  it('formata datas e meses em português', () => {
    expect(formatDate('2026-05-10')).toBe('10/05/2026')
    expect(formatDate('')).toBe('—')
    expect(formatDate('lixo')).toBe('—')
    expect(monthYear('2026-05-10')).toBe('maio de 2026')
    expect(monthYear('')).toBe('')
  })

  it('todayIso usa a data local com zeros à esquerda', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(todayIso(new Date(2026, 10, 23))).toBe('2026-11-23')
  })
})

describe('visitStats e descrição da compra', () => {
  it('conta visitas, a última e quantas correram bem', () => {
    expect(visitStats(joao)).toEqual({ count: 3, last: '2026-04-20', liked: 2 })
    expect(visitStats(ana)).toEqual({ count: 0, last: '', liked: 0 })
  })

  it('descreve a casa comprada', () => {
    expect(describePurchase(joao.purchase!).replace(/\s+/g, ' ')).toBe('apartamento T2 em Torres Vedras (240 000 €)')
    expect(describePurchase({ ...newPurchase('2026-01-01'), propertyType: 'terreno' })).toBe('terreno')
  })
})

describe('filterClients', () => {
  it('sem filtros devolve todos', () => {
    expect(ids(filterClients(all, emptyFilters))).toEqual(['joao', 'maria', 'rui', 'ana'])
    expect(hasActiveFilters(emptyFilters)).toBe(false)
  })

  it('filtra pelo período da compra, incluindo os limites', () => {
    expect(ids(filterClients(all, { ...emptyFilters, purchasedFrom: '2026-01-01' }))).toEqual(['joao'])
    expect(ids(filterClients(all, { ...emptyFilters, purchasedTo: '2025-12-31' }))).toEqual(['maria'])
    expect(ids(filterClients(all, { ...emptyFilters, purchasedFrom: '2025-11-30', purchasedTo: '2026-05-10' }))).toEqual(['joao', 'maria'])
    expect(ids(filterClients(all, { ...emptyFilters, purchasedFrom: '2026-05-11', purchasedTo: '2026-12-31' }))).toEqual([])
  })

  it('filtra pelo tipo de casa, tipologia e localização da compra', () => {
    expect(ids(filterClients(all, { ...emptyFilters, propertyType: 'moradia' }))).toEqual(['maria'])
    expect(ids(filterClients(all, { ...emptyFilters, typology: 'T2' }))).toEqual(['joao'])
    expect(ids(filterClients(all, { ...emptyFilters, location: 'torres' }))).toEqual(['joao'])
    expect(ids(filterClients(all, { ...emptyFilters, propertyType: 'apartamento', typology: 'T2', location: 'Torres Vedras', purchasedFrom: '2026-01-01' }))).toEqual(['joao'])
  })

  it('só conta a compra de clientes com estado "Comprou"', () => {
    const desistiu = { ...joao, id: 'x', status: 'desistiu' as const }
    expect(ids(filterClients([desistiu], { ...emptyFilters, propertyType: 'apartamento' }))).toEqual([])
  })

  it('filtra pelo estado', () => {
    expect(ids(filterClients(all, { ...emptyFilters, status: 'procura' }))).toEqual(['rui'])
    expect(ids(filterClients(all, { ...emptyFilters, status: 'comprou' }))).toEqual(['joao', 'maria'])
  })

  it('a pesquisa de texto ignora acentos e maiúsculas e procura também nas notas das visitas', () => {
    expect(ids(filterClients(all, { ...emptyFilters, text: 'evora' }))).toEqual(['rui'])
    expect(ids(filterClients(all, { ...emptyFilters, text: 'JOAO@' }))).toEqual(['joao'])
    expect(ids(filterClients(all, { ...emptyFilters, text: 'cozinha pequena' }))).toEqual(['joao'])
    expect(ids(filterClients(all, { ...emptyFilters, text: 'garagem' }))).toEqual(['joao'])
    expect(ids(filterClients(all, { ...emptyFilters, text: 'jardim' }))).toEqual(['maria'])
    expect(ids(filterClients(all, { ...emptyFilters, text: 'obras' }))).toEqual(['rui'])
  })

  it('combina texto e estado', () => {
    expect(ids(filterClients(all, { ...emptyFilters, text: 'exemplo.pt', status: 'comprou' }))).toEqual(['joao', 'maria'])
    expect(ids(filterClients(all, { ...emptyFilters, text: 'exemplo.pt', status: 'procura' }))).toEqual([])
  })
})

describe('sortClients', () => {
  it('ordena do mais recente para o mais antigo, pela compra ou pelo início', () => {
    // rui (início 2026-06-01) > joao (compra 2026-05-10) > maria (compra 2025-11-30) ... ana (início 2025-12-01) fica antes de maria
    expect(ids(sortClients(all))).toEqual(['rui', 'joao', 'ana', 'maria'])
  })
})

describe('mensagens de contacto', () => {
  it('mensagem a um comprador anterior refere a compra e o possível comprador', () => {
    const message = buildContactMessage('vender', joao, 'Ana Silva')
    expect(message.startsWith('Olá João,')).toBe(true)
    expect(message).toContain('compra em maio de 2026')
    expect(message).toContain('(apartamento T2 em Torres Vedras)')
    expect(message).not.toContain('240')
    expect(message).toContain('possível comprador')
    expect(message.endsWith('Ana Silva')).toBe(true)
  })

  it('funciona sem nome nem compra', () => {
    const message = buildContactMessage('vender', client({ id: 'z', status: 'procura' }), '')
    expect(message.startsWith('Olá,')).toBe(true)
    expect(message).toContain('Foi um prazer acompanhar a tua compra.')
  })

  it('mensagem para retomar a procura', () => {
    const message = buildContactMessage('retomar', rui, '')
    expect(message).toContain('procura de casa')
    expect(message).not.toContain('possível comprador')
    expect(contactSubject('vender')).toContain('comprador')
    expect(contactSubject('retomar')).toContain('procura')
  })

  it('valida o email e codifica o endereço de email', () => {
    expect(isEmail('joao@exemplo.pt')).toBe(true)
    expect(isEmail(' joao@exemplo.pt ')).toBe(true)
    expect(isEmail('joao@')).toBe(false)
    expect(isEmail('')).toBe(false)
    expect(isEmail('a b@c.pt')).toBe(false)
    expect(mailtoUrl('joao@exemplo.pt', 'Olá & tudo?', 'Linha 1\nLinha 2')).toBe('mailto:joao@exemplo.pt?subject=Ol%C3%A1%20%26%20tudo%3F&body=Linha%201%0ALinha%202')
    expect(mailtoUrl('inválido', 'a', 'b')).toBe('')
  })
})

describe('parseHistory e cópia de segurança', () => {
  it('descarta só o que é inutilizável e corrige campos inválidos', () => {
    const parsed = parseHistory([
      { id: 'a', name: 'Ana', status: 'voou', startedAt: '10/01/2026', visits: [{ id: 'v1', date: '2026-02-01', interest: 'adorou' }, 'lixo', { date: '2026-02-02' }], purchase: { date: '2026-05-01', priceEur: -5, propertyType: 'castelo' } },
      'lixo',
      { name: 'sem id' },
      null,
    ])
    expect(parsed).toHaveLength(1)
    expect(parsed[0].status).toBe('procura')
    expect(parsed[0].startedAt).toBe('')
    expect(parsed[0].visits).toHaveLength(1)
    expect(parsed[0].visits[0].interest).toBe('')
    expect(parsed[0].purchase?.priceEur).toBeNull()
    expect(parsed[0].purchase?.propertyType).toBe('apartamento')
    expect(parseHistory(undefined)).toEqual([])
  })

  it('a cópia de segurança exporta e volta a importar o mesmo conteúdo', () => {
    const text = serializeBackup(all, new Date('2026-10-24T10:00:00Z'))
    expect(JSON.parse(text)).toMatchObject({ app: 'casanexa-historico', version: 1, exportedAt: '2026-10-24T10:00:00.000Z' })
    const { clients, error } = parseBackup(text)
    expect(error).toBe('')
    expect(clients).toEqual(all)
  })

  it('rejeita ficheiros inválidos e aceita uma lista simples', () => {
    expect(parseBackup('não é json').error).toContain('inválido')
    expect(parseBackup('{"clients":[]}').error).toContain('clientes utilizáveis')
    expect(parseBackup(JSON.stringify([joao])).clients).toHaveLength(1)
  })

  it('juntar a cópia substitui por id e acrescenta os novos', () => {
    const editado = { ...joao, name: 'João M. (editado)' }
    const novo = client({ id: 'novo', name: 'Novo' })
    const { merged, added, updated } = mergeClients([joao, maria], [editado, novo])
    expect(added).toBe(1)
    expect(updated).toBe(1)
    expect(merged.map((c) => c.id).sort()).toEqual(['joao', 'maria', 'novo'])
    expect(merged.find((c) => c.id === 'joao')?.name).toBe('João M. (editado)')
  })
})

describe('migração dos clientes da antiga caixa de entrada', () => {
  const legacy = [
    { id: 'c1', name: 'Inês Carvalho (exemplo)', email: 'ines@email.pt' },
    { id: 'c3', name: 'João Martins (exemplo)' },
    { id: 'abc-123', name: ' Ana Real ', email: 'ana@exemplo.pt', phone: '912 111 222', zone: 'Torres Vedras', typology: 'T2', budget: 250000, notes: 'Prefere luz', stage: 'Visitas', wantsToSell: true, followUp: '2026-11-05T10:00' },
    { id: 'sem-datas', name: 'Rui', followUp: 'lixo' },
    'lixo',
    null,
  ]

  it('descarta os 3 clientes de exemplo e converte os restantes mantendo o id', () => {
    const { clients, imported } = migrateLegacyClients(legacy, [])
    expect(imported).toBe(2)
    expect(clients.map((c) => c.id)).toEqual(['abc-123', 'sem-datas'])
    const ana = clients[0]
    expect(ana).toMatchObject({ name: 'Ana Real', email: 'ana@exemplo.pt', phone: '912 111 222', status: 'procura', followUpAt: '2026-11-05' })
    expect(ana.learned.replace(/\s+/g, ' ')).toBe('T2 em Torres Vedras até 250 000 €')
    expect(ana.notes).toBe('Prefere luz Tem interesse em vender. Fase anterior: Visitas.')
    expect(clients[1].followUpAt).toBe('')
  })

  it('não duplica clientes que já existem no histórico e ignora dados inválidos', () => {
    const existing = [client({ id: 'abc-123', name: 'Ana (já no histórico)' })]
    const { clients, imported } = migrateLegacyClients(legacy, existing)
    expect(imported).toBe(1)
    expect(clients.find((c) => c.id === 'abc-123')?.name).toBe('Ana (já no histórico)')
    expect(migrateLegacyClients('lixo', existing)).toEqual({ clients: existing, imported: 0 })
    expect(migrateLegacyClients(null, [])).toEqual({ clients: [], imported: 0 })
  })

  it('perfis do histórico antigos ganham o campo de follow-up vazio', () => {
    expect(parseHistory([{ id: 'x', name: 'Sem follow-up' }])[0].followUpAt).toBe('')
  })
})

describe('carteira de clientes', () => {
  const wants = (patch: Partial<ReturnType<typeof emptyWants>>) => ({ ...emptyWants(), ...patch })
  const ines = client({ id: 'ines', name: 'Inês Carvalho', status: 'procura', followUpAt: '2026-11-10', wants: wants({ clientType: 'comprador', priority: 'quente', propertyTypes: ['apartamento'], typologies: ['T2'], district: 'lisboa', municipality: 'Torres Vedras', otherZones: 'Mafra', budgetMin: 180000, budgetMax: 250000, features: ['elevador', 'garagem'] }) })
  const bruno = client({ id: 'bruno', name: 'Bruno Faria', status: 'procura', followUpAt: '2026-11-01', wants: wants({ clientType: 'investidor', priority: 'morno', propertyTypes: ['apartamento'], typologies: ['T1'], district: 'porto', municipality: 'Porto', budgetMax: 150000 }) })
  const carla = client({ id: 'carla', name: 'Carla Sousa', status: 'procura', wants: wants({ clientType: 'comprador', priority: 'frio', propertyTypes: ['moradia'], typologies: ['T4'], municipality: 'Sintra', budgetMin: 400000, budgetMax: 600000 }) })
  const dario = client({ id: 'dario', name: 'Dário Lima', status: 'comprou', wants: wants({ clientType: 'comprador-vendedor' }), purchase: { ...newPurchase('2026-03-01'), location: 'Setúbal' } })
  const eva = client({ id: 'eva', name: 'Eva Reis', status: 'desistiu', wants: wants({ priority: 'quente' }) })
  const carteira = [eva, dario, carla, bruno, ines]
  const ids = (list: HistoryClient[]) => list.map((c) => c.id)

  it('os clientes novos têm um perfil de procura vazio e perfis antigos ganham valores por omissão', () => {
    const novo = newClient('2026-01-01')
    expect(novo.wants).toEqual(emptyWants())
    const [antigo] = parseHistory([{ id: 'x', name: 'Sem wants' }])
    expect(antigo.wants).toEqual(emptyWants())
  })

  it('corrige valores inválidos da procura sem perder os válidos', () => {
    const [c] = parseHistory([{ id: 'x', wants: { priority: 'urgentíssimo', clientType: 'investidor', budgetMax: -3, municipality: 'Porto', features: ['elevador', 'heliporto', 4] } }])
    expect(c.wants.priority).toBe('')
    expect(c.wants.clientType).toBe('investidor')
    expect(c.wants.budgetMax).toBeNull()
    expect(c.wants.municipality).toBe('Porto')
    expect(c.wants.features).toEqual(['elevador'])
    expect(parseHistory([{ id: 'y', wants: 'lixo' }])[0].wants).toEqual(emptyWants())
  })

  it('filtra por estado, tipo de cliente, prioridade e tipo de casa', () => {
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, status: 'procura' }))).toEqual(['carla', 'bruno', 'ines'])
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, clientType: 'investidor' }))).toEqual(['bruno'])
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, priority: 'quente' }))).toEqual(['eva', 'ines'])
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, propertyType: 'moradia' }))).toEqual(['carla'])
  })

  it('a zona procura no concelho, noutras zonas e no distrito, sem acentos', () => {
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, zone: 'torres' }))).toEqual(['ines'])
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, zone: 'mafra' }))).toEqual(['ines'])
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, zone: 'PORTO' }))).toEqual(['bruno'])
  })

  it('o filtro de orçamento aceita quem tem um intervalo que se sobrepõe ao pedido', () => {
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, budgetFrom: 200000, budgetTo: 300000 }))).toEqual(['ines'])
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, budgetTo: 160000 }))).toEqual(['bruno'])
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, budgetFrom: 500000 }))).toEqual(['carla'])
    // sem orçamento definido, fica de fora quando o filtro está ativo
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, budgetFrom: 1 }))).toEqual(['carla', 'bruno', 'ines'])
  })

  it('a pesquisa de texto inclui a zona, as notas e a localização da compra', () => {
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, text: 'setubal' }))).toEqual(['dario'])
    expect(ids(filterPortfolio(carteira, { ...emptyPortfolioFilters, text: 'ines' }))).toEqual(['ines'])
    expect(hasActivePortfolioFilters(emptyPortfolioFilters)).toBe(false)
    expect(hasActivePortfolioFilters({ ...emptyPortfolioFilters, budgetTo: 1 })).toBe(true)
  })

  it('ordena: quem procura primeiro, depois prioridade, depois o próximo contacto', () => {
    expect(ids(sortPortfolio(carteira))).toEqual(['ines', 'bruno', 'carla', 'dario', 'eva'])
  })

  it('resume a carteira', () => {
    expect(portfolioStats(carteira)).toEqual({ total: 5, procura: 3, comprou: 1, desistiu: 1, quentes: 1 })
  })

  it('descreve o que o cliente procura', () => {
    expect(describeWants(ines.wants).replace(/\s+/g, ' ')).toBe('apartamento T2 · Torres Vedras, Mafra · 180 000 € a 250 000 €')
    expect(describeWants(bruno.wants).replace(/\s+/g, ' ')).toBe('apartamento T1 · Porto · até 150 000 €')
    expect(describeWants(emptyWants())).toBe('')
    expect(describeWants(wants({ typologies: ['T3'], budgetMin: 100000 })).replace(/\s+/g, ' ')).toBe('imóvel T3 · desde 100 000 €')
  })
})

describe('vários tipos de casa por cliente', () => {
  const withTypes = (id: string, propertyTypes: ReturnType<typeof emptyWants>['propertyTypes']) => ({ ...newClient('2026-01-01'), id, name: id, wants: { ...emptyWants(), propertyTypes } })

  it('fichas antigas com um só tipo passam para a lista', () => {
    const [moradia, vazio] = parseHistory([
      { id: 'a', name: 'Ana', wants: { propertyType: 'moradia' } },
      { id: 'b', name: 'Rui', wants: { propertyType: '' } },
    ])
    expect(moradia.wants.propertyTypes).toEqual(['moradia'])
    expect(vazio.wants.propertyTypes).toEqual([])
  })

  it('descarta tipos inválidos e mantém os válidos', () => {
    const [client] = parseHistory([{ id: 'a', name: 'Ana', wants: { propertyTypes: ['moradia', 'castelo', 42, 'apartamento'] } }])
    expect(client.wants.propertyTypes).toEqual(['apartamento', 'moradia'])
  })

  it('o filtro encontra clientes que procuram o tipo entre vários', () => {
    const both = withTypes('ambos', ['apartamento', 'moradia'])
    const only = withTypes('so-apartamento', ['apartamento'])
    const ids = (list: ReturnType<typeof withTypes>[]) => list.map((item) => item.id)
    expect(ids(filterPortfolio([both, only], { ...emptyPortfolioFilters, propertyType: 'moradia' }))).toEqual(['ambos'])
    expect(ids(filterPortfolio([both, only], { ...emptyPortfolioFilters, propertyType: 'apartamento' }))).toEqual(['ambos', 'so-apartamento'])
  })

  it('o resumo junta os tipos com "ou"', () => {
    expect(describeWants({ ...emptyWants(), propertyTypes: ['apartamento', 'moradia'], typologies: ['T2'] })).toBe('apartamento ou moradia T2')
  })
})

describe('várias tipologias por cliente', () => {
  it('fichas antigas com uma só tipologia passam para a lista', () => {
    const [ana, rui] = parseHistory([
      { id: 'a', name: 'Ana', wants: { typology: 'T2' } },
      { id: 'b', name: 'Rui', wants: { typologies: ['T3', 'T9', 'T2'] } },
    ])
    expect(ana.wants.typologies).toEqual(['T2'])
    expect(rui.wants.typologies).toEqual(['T2', 'T3'])
  })

  it('o resumo junta as tipologias', () => {
    expect(describeWants({ ...emptyWants(), propertyTypes: ['apartamento'], typologies: ['T2', 'T3'] })).toBe('apartamento T2/T3')
  })
})

describe('prazo para comprar', () => {
  const at = (startedAt: string, timeframe: ReturnType<typeof emptyWants>['timeframe']) => ({ startedAt, wants: { ...emptyWants(), timeframe } })

  it('conta o prazo escolhido a partir da entrada na carteira', () => {
    expect(purchaseWindow(at('2026-01-10', '1-3-meses'), '2026-03-01')).toEqual({ state: 'a-decorrer', deadline: '2026-04-10', days: 40, elapsed: 50 / 90 })
    expect(purchaseWindow(at('2026-01-10', 'imediato'), '2026-02-10')).toEqual({ state: 'a-decorrer', deadline: '2026-02-10', days: 0, elapsed: 1 })
  })

  it('assinala o prazo ultrapassado e a falta de prazo', () => {
    expect(purchaseWindow(at('2026-01-10', '3-6-meses'), '2026-07-20')).toEqual({ state: 'ultrapassado', deadline: '2026-07-10', days: 10, elapsed: 1 })
    expect(purchaseWindow(at('2026-01-10', ''), '2026-07-20')).toEqual({ state: 'sem-prazo' })
    expect(purchaseWindow(at('', '3-6-meses'), '2026-07-20')).toEqual({ state: 'sem-prazo' })
  })

  it('escreve o que falta em português', () => {
    expect(describePurchaseWindow({ state: 'a-decorrer', deadline: '2026-04-10', days: 1, elapsed: 0.5 })).toBe('Faltam 1 dia (até 10/04/2026)')
    expect(describePurchaseWindow({ state: 'ultrapassado', deadline: '2026-07-10', days: 10, elapsed: 1 })).toBe('Prazo ultrapassado há 10 dias (era 10/07/2026)')
    expect(describePurchaseWindow({ state: 'sem-prazo' })).toBe('Sem prazo definido')
  })
})

describe('tempo desde a compra', () => {
  it('escreve quanto tempo passou', () => {
    expect(timeSince('2026-10-24', '2026-10-24')).toBe('hoje')
    expect(timeSince('2026-10-23', '2026-10-24')).toBe('há 1 dia')
    expect(timeSince('2026-10-04', '2026-10-24')).toBe('há 20 dias')
    expect(timeSince('2026-07-25', '2026-10-24')).toBe('há 2 meses')
    expect(timeSince('2026-07-24', '2026-10-24')).toBe('há 3 meses')
    expect(timeSince('2025-08-10', '2026-10-24')).toBe('há 1 ano e 2 meses')
    expect(timeSince('2024-10-24', '2026-10-24')).toBe('há 2 anos')
  })

  it('ignora datas inválidas ou futuras', () => {
    expect(timeSince('', '2026-10-24')).toBe('')
    expect(timeSince('2027-01-01', '2026-10-24')).toBe('')
  })
})
