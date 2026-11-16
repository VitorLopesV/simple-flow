import { describe, expect, it } from 'vitest'

import { addDays, formatMinutes, mondayOf, sprintDays, taskPoints } from './sprint'

describe('datas do sprint', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-11-16', -1)).toBe('2026-11-15')
  })

  it('acha a segunda da semana; sábado e domingo pertencem à semana que acabou', () => {
    expect(mondayOf('2026-11-16')).toBe('2026-11-16')
    expect(mondayOf('2026-11-18')).toBe('2026-11-16')
    expect(mondayOf('2026-11-20')).toBe('2026-11-16')
    expect(mondayOf('2026-11-21')).toBe('2026-11-16')
    expect(mondayOf('2026-11-22')).toBe('2026-11-16')
  })

  it('monta seg–sex marcando hoje e travando os dias passados', () => {
    const days = sprintDays('2026-11-16', '2026-11-18')
    expect(days.map((day) => day.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'])
    expect(days.map((day) => day.locked)).toEqual([true, true, false, false, false])
    expect(days.filter((day) => day.isToday).map((day) => day.short)).toEqual(['Qua'])
  })

  it('trava todos os dias de um sprint que já acabou e nenhum de um futuro', () => {
    expect(sprintDays('2026-11-09', '2026-11-18').every((day) => day.locked)).toBe(true)
    expect(sprintDays('2026-11-23', '2026-11-18').some((day) => day.locked)).toBe(false)
  })
})

describe('taskPoints', () => {
  it('segue a fórmula do backend', () => {
    expect(taskPoints(60, 'DIFICIL', 'ALTA')).toBe(15)
    expect(taskPoints(240, 'MEDIA', 'MEDIA')).toBe(23)
    expect(taskPoints(15, 'FACIL', 'BAIXA')).toBe(2)
  })
})

describe('formatMinutes', () => {
  it('formata horas e minutos', () => {
    expect(formatMinutes(0)).toBe('0 min')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatMinutes(90)).toBe('1 h 30 min')
  })
})
