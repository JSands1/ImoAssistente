import { afterEach, describe, expect, it, vi } from 'vitest'
import { clientAppointmentCount, deleteConfirmation, purgeClientTraces } from './client-cleanup'

function stubStorage(initial: Record<string, unknown>) {
  const store = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
  })
  return (key: string) => JSON.parse(store.get(key) ?? 'null')
}

const appointments = [
  { id: 'a1', clientId: 'ines', propertyId: 'p1', date: '2026-11-01T10:00' },
  { id: 'a2', clientId: 'rui', propertyId: 'p1', date: '2026-11-02T10:00' },
  { id: 'a3', clientId: 'ines', propertyId: '', date: '2026-11-03T10:00' },
]

describe('apagar um cliente', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('conta as marcações do cliente', () => {
    stubStorage({ 'casanexa-appointments': appointments })
    expect(clientAppointmentCount('ines')).toBe(2)
    expect(clientAppointmentCount('rui')).toBe(1)
    expect(clientAppointmentCount('ninguém')).toBe(0)
  })

  it('remove as marcações e os extras de procura desse cliente e mantém os dos outros', () => {
    const read = stubStorage({
      'casanexa-appointments': appointments,
      'casanexa-search-extras': { ines: { areaMin: 60 }, rui: { areaMin: 80 } },
    })
    purgeClientTraces('ines')
    expect(read('casanexa-appointments')).toEqual([appointments[1]])
    expect(read('casanexa-search-extras')).toEqual({ rui: { areaMin: 80 } })
  })

  it('não falha com dados em falta ou corrompidos', () => {
    stubStorage({ 'casanexa-appointments': 'lixo', 'casanexa-search-extras': [1, 2] })
    expect(() => purgeClientTraces('ines')).not.toThrow()
    expect(clientAppointmentCount('ines')).toBe(0)
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } })
    expect(() => purgeClientTraces('ines')).not.toThrow()
    expect(clientAppointmentCount('ines')).toBe(0)
  })

  it('o aviso diz o que vai ser removido', () => {
    expect(deleteConfirmation('Inês Carvalho', 0)).toContain('Apagar Inês Carvalho?')
    expect(deleteConfirmation('Inês Carvalho', 0)).not.toContain('marcaç')
    expect(deleteConfirmation('Inês', 1)).toContain('1 marcação na agenda')
    expect(deleteConfirmation('Inês', 3)).toContain('3 marcações na agenda')
    expect(deleteConfirmation('  ', 0)).toContain('Apagar este cliente?')
  })
})
