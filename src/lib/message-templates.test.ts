import { describe, expect, it } from 'vitest'
import { defaultTemplates, describeDay, fillTemplate, missingFields, parseTemplates, placeholdersIn, upgradeTemplates } from './message-templates'

describe('campos', () => {
  it('encontra os campos conhecidos, sem repetir', () => {
    expect(placeholdersIn('Olá {nome}, {imovel} às {hora}. {nome} {desconhecido}')).toEqual(['nome', 'imovel', 'hora'])
  })

  it('preenche o que tem valor e deixa o resto visível', () => {
    expect(fillTemplate('Olá {nome}, visita a {imovel}.', { nome: 'Ana', imovel: '  ' })).toBe('Olá Ana, visita a {imovel}.')
  })

  it('campos desconhecidos ficam como estão', () => {
    expect(fillTemplate('Olá {foo}', { nome: 'Ana' })).toBe('Olá {foo}')
  })

  it('diz o que falta preencher', () => {
    expect(missingFields('Olá {nome}, às {hora}', { nome: 'Ana' })).toEqual(['hora'])
  })

  it('escreve o dia por extenso', () => {
    expect(describeDay('2026-10-30')).toBe('sexta-feira, 30 de outubro')
    expect(describeDay('')).toBe('')
  })
})

describe('modelos', () => {
  it('os de origem usam campos que existem', () => {
    for (const template of defaultTemplates) {
      expect(template.body.match(/\{[a-z]+\}/g)?.every((field) => placeholdersIn(field).length === 1)).toBe(true)
    }
  })

  it('sem dados válidos voltam os de origem; modelos inválidos são descartados', () => {
    expect(parseTemplates(null)).toBe(defaultTemplates)
    expect(parseTemplates([{ nada: 1 }, { id: '', title: 'x' }])).toBe(defaultTemplates)
    expect(parseTemplates([{ id: 'a', title: 'Meu', body: 'Olá' }, 5])).toEqual([{ id: 'a', title: 'Meu', body: 'Olá' }])
  })

  it('o texto antigo do pós-venda passa para o novo; um texto alterado fica como está', () => {
    const old = 'Olá {nome}, espero que estejas a gostar da casa nova! Se conheceres alguém que esteja a comprar ou a vender, ficaria muito agradecido se me recomendasses. Um abraço, {consultor}.'
    const upgraded = upgradeTemplates([{ id: 'pos-venda', title: 'Pós-venda e recomendação', body: old }])
    expect(upgraded[0].body).toContain('Confirmar a alteração de morada')
    const edited = { id: 'pos-venda', title: 'Meu', body: 'Texto meu' }
    expect(upgradeTemplates([edited])).toEqual([edited])
  })
})
