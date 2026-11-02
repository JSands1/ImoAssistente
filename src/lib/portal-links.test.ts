import { describe, expect, it } from 'vitest'
import { buildMessage, buildPortalLinks, describeProfile, emptyProfile, firstName, parseProfiles, slugify, whatsappNumber, whatsappUrl, type SearchProfile } from './portal-links'

const joao: SearchProfile = {
  ...emptyProfile('p1'),
  name: 'João Martins',
  phone: '912 345 678',
  propertyType: 'apartamento',
  typology: 'T2',
  district: 'lisboa',
  municipality: 'Torres Vedras',
  budgetMax: 250000,
  preferences: 'elevador e garagem',
}

describe('slugify', () => {
  it('remove acentos e junta com hífenes', () => {
    expect(slugify('Torres Vedras')).toBe('torres-vedras')
    expect(slugify('  Vila Nova de Gaia ')).toBe('vila-nova-de-gaia')
    expect(slugify('Évora')).toBe('evora')
    expect(slugify('São João da Madeira')).toBe('sao-joao-da-madeira')
    expect(slugify('Setúbal / Azeitão')).toBe('setubal-azeitao')
  })
})

describe('buildPortalLinks', () => {
  it('gera o endereço do Imovirtual igual ao testado para o caso do João', () => {
    const [imovirtual] = buildPortalLinks(joao)
    expect(imovirtual.url).toBe('https://www.imovirtual.com/pt/resultados/comprar/apartamento,t2/lisboa/torres-vedras?priceMax=250000')
    expect(imovirtual.status).toBe('tested')
  })

  it('inclui preço mínimo e máximo e suporta moradias e outros distritos', () => {
    const [imovirtual, sapo] = buildPortalLinks({ ...joao, propertyType: 'moradia', typology: 'T3', district: 'porto', municipality: 'Porto', budgetMin: 200000, budgetMax: 300000 })
    expect(imovirtual.url).toBe('https://www.imovirtual.com/pt/resultados/comprar/moradia,t3/porto/porto?priceMax=300000&priceMin=200000')
    expect(sapo.url).toBe('https://casa.sapo.pt/comprar-moradias/t3/porto/?gp=300000')
    expect(sapo.note).toContain('preço máximo')
  })

  it('sem tipologia nem preço não acrescenta filtros', () => {
    const [imovirtual, sapo] = buildPortalLinks({ ...joao, typology: '', budgetMax: null })
    expect(imovirtual.url).toBe('https://www.imovirtual.com/pt/resultados/comprar/apartamento/lisboa/torres-vedras')
    expect(sapo.url).toBe('https://casa.sapo.pt/comprar-apartamentos/torres-vedras/')
  })

  it('o Idealista abre direto no site, com os filtros no formato das páginas reais', () => {
    const idealista = buildPortalLinks(joao)[2]
    expect(idealista.url).toBe('https://www.idealista.pt/comprar-casas/torres-vedras/com-preco-max_250000,apartamentos,t2/')
    expect(new URL(idealista.url).hostname).toBe('www.idealista.pt')
    expect(idealista.status).toBe('unverified')
  })

  it('o Idealista suporta moradias, preço mínimo, sem filtros e o concelho de Setúbal', () => {
    expect(buildPortalLinks({ ...joao, propertyType: 'moradia', typology: 'T3', budgetMin: 200000, budgetMax: 300000 })[2].url)
      .toBe('https://www.idealista.pt/comprar-casas/torres-vedras/com-preco-min_200000,preco-max_300000,moradias,t3/')
    expect(buildPortalLinks({ ...joao, typology: '', budgetMax: null })[2].url).toBe('https://www.idealista.pt/comprar-casas/torres-vedras/com-apartamentos/')
    expect(buildPortalLinks({ ...joao, district: 'setubal', municipality: 'Setúbal' })[2].url).toBe('https://www.idealista.pt/comprar-casas/setubal/setubal/com-preco-max_250000,apartamentos,t2/')
  })

  it('não gera ligações sem concelho', () => {
    expect(buildPortalLinks({ ...joao, municipality: '  ' })).toEqual([])
  })

  it('não deixa caracteres especiais do concelho estragarem o endereço', () => {
    const [imovirtual] = buildPortalLinks({ ...joao, municipality: 'Torres Vedras/../x?y=1' })
    expect(new URL(imovirtual.url).pathname).toBe('/pt/resultados/comprar/apartamento,t2/lisboa/torres-vedras-x-y-1')
  })
})

describe('describeProfile', () => {
  it('descreve o orçamento conforme os limites indicados', () => {
    expect(describeProfile(joao)).toContain('apartamento T2 em Torres Vedras até ')
    expect(describeProfile({ ...joao, budgetMin: 150000 })).toContain('entre ')
    expect(describeProfile({ ...joao, budgetMax: null, budgetMin: 150000 })).toContain('a partir de ')
    expect(describeProfile({ ...joao, budgetMax: null })).toBe('apartamento T2 em Torres Vedras')
  })
})

describe('buildMessage', () => {
  it('cumprimenta pelo primeiro nome e inclui uma ligação por portal e a assinatura', () => {
    const links = buildPortalLinks(joao)
    const message = buildMessage({ profile: joao, links, signature: 'Ana Silva · CasaNexa' })
    expect(message.startsWith('Olá João,')).toBe(true)
    for (const link of links) expect(message).toContain(link.url)
    expect(message).toContain('elevador e garagem')
    expect(message).toContain('já ter sido vendido')
    expect(message.endsWith('Ana Silva · CasaNexa')).toBe(true)
  })

  it('funciona sem nome, sem preferências e sem assinatura', () => {
    const profile = { ...joao, name: '', preferences: '' }
    const message = buildMessage({ profile, links: buildPortalLinks(profile), signature: '' })
    expect(message.startsWith('Olá,')).toBe(true)
    expect(message).not.toContain('Tive em conta')
  })

  it('firstName lida com espaços e vazio', () => {
    expect(firstName('  Maria  Luísa ')).toBe('Maria')
    expect(firstName('')).toBe('')
  })
})

describe('whatsapp', () => {
  it('normaliza números portugueses e internacionais', () => {
    expect(whatsappNumber('912 345 678')).toBe('351912345678')
    expect(whatsappNumber('+351 912 345 678')).toBe('351912345678')
    expect(whatsappNumber('00351912345678')).toBe('351912345678')
    expect(whatsappNumber('123')).toBe('')
    expect(whatsappNumber('')).toBe('')
  })

  it('gera o endereço com o texto codificado, com ou sem número', () => {
    expect(whatsappUrl('Olá & tudo?', '912345678')).toBe('https://wa.me/351912345678?text=Ol%C3%A1%20%26%20tudo%3F')
    expect(whatsappUrl('Olá', '')).toBe('https://wa.me/?text=Ol%C3%A1')
  })
})

describe('parseProfiles', () => {
  it('descarta só os perfis inutilizáveis e corrige campos inválidos', () => {
    const profiles = parseProfiles([{ id: 'a', municipality: 'Porto', budgetMax: -5, propertyType: 'castelo' }, 'lixo', { nome: 'sem id' }, null])
    expect(profiles).toHaveLength(1)
    expect(profiles[0].budgetMax).toBeNull()
    expect(profiles[0].propertyType).toBe('apartamento')
    expect(parseProfiles(undefined)).toEqual([])
  })
})

describe('filtros adicionais', () => {
  const completo: SearchProfile = {
    ...joao,
    budgetMin: 150000,
    areaMin: 60,
    areaMax: 90,
    condition: 'usado',
    features: ['elevador', 'garagem', 'varanda', 'piscina'],
  }

  it('o Imovirtual aplica preço, área, estado e os extras confirmados', () => {
    const imovirtual = buildPortalLinks(completo)[0]
    expect(imovirtual.url).toBe('https://www.imovirtual.com/pt/resultados/comprar/apartamento,casas-usadas,t2/lisboa/torres-vedras?priceMax=250000&priceMin=150000&areaMin=60&areaMax=90&extras=%5BLIFT%2CGARAGE%2CBALCONY%5D')
    expect(imovirtual.applied).toEqual(['Tipologia', 'Preço máximo', 'Preço mínimo', 'Área mínima', 'Área máxima', 'Elevador', 'Garagem', 'Varanda', 'Estado'])
    expect(imovirtual.notApplied).toEqual(['Piscina'])
  })

  it('o Imovirtual usa "nova-construcao" para imóveis novos e terraço/jardim como extras', () => {
    const [imovirtual] = buildPortalLinks({ ...joao, condition: 'novo', features: ['terraco', 'jardim'] })
    expect(imovirtual.url).toBe('https://www.imovirtual.com/pt/resultados/comprar/apartamento,nova-construcao,t2/lisboa/torres-vedras?priceMax=250000&extras=%5BTERRACE%2CGARDEN%5D')
    expect(imovirtual.notApplied).toEqual([])
  })

  it('o Idealista aplica área, estado e características com os nomes das páginas reais', () => {
    const idealista = buildPortalLinks({ ...completo, condition: 'bom-estado', features: ['elevador', 'garagem', 'varanda', 'terraco', 'jardim', 'piscina', 'ar-condicionado'] })[2]
    expect(idealista.url).toBe('https://www.idealista.pt/comprar-casas/torres-vedras/com-preco-min_150000,preco-max_250000,tamanho-min_60,tamanho-max_90,apartamentos,t2,bom-estado,elevador,garagem,terraco-e-varanda,jardim,piscina,arcondicionado/')
    expect(idealista.notApplied).toEqual([])
  })

  it('o Idealista usa "novo" e "para-reformar", junta terraço e varanda num só filtro e não tem "usado"', () => {
    expect(buildPortalLinks({ ...joao, condition: 'novo' })[2].url).toContain(',t2,novo/')
    expect(buildPortalLinks({ ...joao, condition: 'recuperar' })[2].url).toContain(',t2,para-reformar/')
    expect(buildPortalLinks({ ...joao, features: ['terraco', 'varanda'] })[2].url.match(/terraco-e-varanda/g)).toHaveLength(1)
    const usado = buildPortalLinks(completo)[2]
    expect(usado.url).not.toContain('usado')
    expect(usado.notApplied).toEqual(['Estado'])
  })

  it('o Casa Sapo só aplica tipologia e preço máximo e indica o resto como por marcar', () => {
    const sapo = buildPortalLinks(completo)[1]
    expect(sapo.url).toBe('https://casa.sapo.pt/comprar-apartamentos/t2/torres-vedras/?gp=250000')
    expect(sapo.applied).toEqual(['Tipologia', 'Preço máximo'])
    expect(sapo.notApplied).toEqual(['Preço mínimo', 'Área mínima', 'Área máxima', 'Estado', 'Elevador', 'Garagem', 'Varanda', 'Piscina'])
  })

  it('sem filtros extra não há nada por marcar', () => {
    for (const link of buildPortalLinks(joao)) expect(link.notApplied).toEqual([])
  })

  it('a descrição do perfil e a mensagem incluem os novos filtros e avisam do que falta marcar', () => {
    const description = describeProfile(completo)
    expect(description).toContain('com 60 a 90 m²')
    expect(description).toContain('(usado)')
    expect(description).toContain('com elevador, garagem, varanda e piscina')
    const message = buildMessage({ profile: completo, links: buildPortalLinks(completo), signature: '' })
    expect(message).toContain('(neste portal marca ainda: piscina)')
    expect(message).toContain('(neste portal marca ainda: preço mínimo, área mínima, área máxima, estado, elevador, garagem, varanda e piscina)')
  })

  it('perfis guardados antes dos filtros novos continuam a abrir, com valores por omissão', () => {
    const [antigo] = parseProfiles([{ id: 'x', municipality: 'Porto', typology: 'T2', budgetMax: 300000 }])
    expect(antigo.areaMin).toBeNull()
    expect(antigo.condition).toBe('')
    expect(antigo.features).toEqual([])
  })

  it('ignora características e estados inválidos nos perfis guardados', () => {
    const [perfil] = parseProfiles([{ id: 'x', features: ['elevador', 'heliporto', 7], condition: 'ruína' }])
    expect(perfil.features).toEqual(['elevador'])
    expect(perfil.condition).toBe('')
  })
})

describe('distrito em falta', () => {
  it('o Imovirtual avisa que falta o distrito e deixa de contar como testado', () => {
    const [imovirtual, sapo, idealista] = buildPortalLinks({ ...joao, district: '' })
    expect(imovirtual.status).toBe('unverified')
    expect(imovirtual.note).toContain('Falta o distrito')
    expect(imovirtual.url).toBe('https://www.imovirtual.com/pt/resultados/comprar/apartamento,t2/torres-vedras?priceMax=250000')
    expect(sapo.url).toContain('casa.sapo.pt')
    expect(idealista.url).toContain('idealista.pt/comprar-casas/torres-vedras/')
  })
})
