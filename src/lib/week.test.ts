import { describe, expect, it } from 'vitest'
import { addDays, dayKey, findConflict, placeDay, startOfWeek, toLocalInput, visibleHours, visitMinutes, weekDays } from './week'

describe('semana', () => {
  it('a semana começa na segunda-feira', () => {
    // 28 de outubro de 2026 é quarta-feira.
    expect(dayKey(startOfWeek(new Date(2026, 9, 28, 15, 30)))).toBe('2026-10-26')
    expect(dayKey(startOfWeek(new Date(2026, 9, 26)))).toBe('2026-10-26')
    // Domingo pertence à semana que começou na segunda anterior.
    expect(dayKey(startOfWeek(new Date(2026, 10, 1)))).toBe('2026-10-26')
  })

  it('tem sete dias seguidos, mesmo a passar de mês', () => {
    expect(weekDays(startOfWeek(new Date(2026, 9, 28))).map(dayKey)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(dayKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01')
  })

  it('escreve a data no formato do campo de data e hora', () => {
    expect(toLocalInput(new Date(2026, 0, 5, 9, 5))).toBe('2026-01-05T09:05')
  })
})

describe('duração da visita', () => {
  it('sem valor válido é uma hora', () => {
    expect(visitMinutes(undefined)).toBe(60)
    expect(visitMinutes('90')).toBe(60)
    expect(visitMinutes(5)).toBe(60)
    expect(visitMinutes(90)).toBe(90)
  })
})

describe('placeDay', () => {
  it('uma visita fica na sua hora, com a sua duração', () => {
    expect(placeDay([{ id: 'a', start: '2026-10-28T10:30', minutes: 60 }], 8 * 60)).toEqual([{ id: 'a', top: 150, height: 60, column: 0, columns: 1 }])
  })

  it('visitas seguidas não se sobrepõem', () => {
    const placed = placeDay([{ id: 'a', start: '2026-10-28T10:00', minutes: 60 }, { id: 'b', start: '2026-10-28T11:00', minutes: 60 }], 0)
    expect(placed.map((item) => [item.id, item.column, item.columns])).toEqual([['a', 0, 1], ['b', 0, 1]])
  })

  it('visitas à mesma hora ficam lado a lado', () => {
    const placed = placeDay([{ id: 'a', start: '2026-10-28T10:00', minutes: 60 }, { id: 'b', start: '2026-10-28T10:30', minutes: 60 }, { id: 'c', start: '2026-10-28T11:00', minutes: 30 }], 0)
    expect(placed.map((item) => [item.id, item.column, item.columns])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 0, 2]])
  })
})

describe('visibleHours', () => {
  it('por omissão mostra o horário de trabalho', () => {
    expect(visibleHours([])).toEqual({ from: 8, to: 20 })
  })

  it('alarga se houver visitas fora desse horário', () => {
    expect(visibleHours([{ id: 'a', start: '2026-10-28T06:30', minutes: 60 }, { id: 'b', start: '2026-10-28T20:30', minutes: 90 }])).toEqual({ from: 6, to: 22 })
  })
})

describe('findConflict', () => {
  const booked = [{ id: 'a', start: '2026-10-28T10:00', minutes: 60 }]

  it('encontra visitas que ocupam o mesmo horário', () => {
    expect(findConflict(booked, '2026-10-28T10:30', 60)?.id).toBe('a')
    expect(findConflict(booked, '2026-10-28T09:30', 60)?.id).toBe('a')
  })

  it('não conta visitas que só se tocam no fim', () => {
    expect(findConflict(booked, '2026-10-28T11:00', 60)).toBeUndefined()
    expect(findConflict(booked, '2026-10-28T09:00', 60)).toBeUndefined()
  })
})
