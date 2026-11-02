import { describe, expect, it } from 'vitest'
import { linkLabel, normalizeLink, phoneHref } from './visit'

describe('normalizeLink', () => {
  it('aceita links com ou sem esquema', () => {
    expect(normalizeLink('https://www.idealista.pt/imovel/123/')).toBe('https://www.idealista.pt/imovel/123/')
    expect(normalizeLink('  idealista.pt/imovel/123 ')).toBe('https://idealista.pt/imovel/123')
  })

  it('recusa o que não é um link web', () => {
    expect(normalizeLink('javascript:alert(1)')).toBe('')
    expect(normalizeLink('ftp://exemplo.pt/x')).toBe('')
    expect(normalizeLink('isto não é um link')).toBe('')
    expect(normalizeLink('localhost')).toBe('')
  })

  it('vazio fica vazio', () => {
    expect(normalizeLink('   ')).toBe('')
  })
})

describe('linkLabel', () => {
  it('mostra só o site', () => {
    expect(linkLabel('https://www.idealista.pt/imovel/123/')).toBe('idealista.pt')
  })
})

describe('phoneHref', () => {
  it('encontra o telefone dentro do contacto', () => {
    expect(phoneHref('Sr. Antunes · 912 345 678')).toBe('tel:912345678')
    expect(phoneHref('+351 912 345 678')).toBe('tel:+351912345678')
  })

  it('sem telefone não há ligação', () => {
    expect(phoneHref('antunes@exemplo.pt')).toBe('')
    expect(phoneHref('Sr. Antunes')).toBe('')
  })
})
