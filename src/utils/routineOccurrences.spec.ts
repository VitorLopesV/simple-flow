import { describe, expect, it } from 'vitest'

import type { RoutineItem } from '@/types/routine'
import { addDaysIso, calculateOccurrences, upcomingOccurrences } from '@/utils/routineOccurrences'

type Rule = Pick<RoutineItem, 'repeat' | 'times'>

const weekly = (days: (1 | 2 | 3 | 4 | 5)[], times: (string | null)[] = [null]): Rule => ({
  repeat: { mode: 'DIAS_DA_SEMANA', days },
  times: times.map((time) => ({ time })),
})

const every = (interval: number, startDate: string, times: (string | null)[] = [null]): Rule => ({
  repeat: { mode: 'A_CADA_N_DIAS', interval, startDate },
  times: times.map((time) => ({ time })),
})

const dates = (list: { date: string }[]) => list.map((o) => o.date)

describe('calculateOccurrences', () => {
  it('dias da semana: só os dias marcados, nunca fim de semana', () => {
    // 2026-11-16 é segunda-feira.
    const result = calculateOccurrences(weekly([1, 3, 5]), '2026-11-16', '2026-11-29')
    expect(dates(result.weekdays)).toEqual(['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23', '2026-11-25', '2026-11-27'])
    expect(result.weekendReminders).toEqual([])
  })

  it('a cada N dias: o que cai em sábado/domingo vira lembrete', () => {
    // 2026-11-16 (seg) a cada 3 dias: 16, 19, 22(dom), 25, 28(sáb).
    const result = calculateOccurrences(every(3, '2026-11-16'), '2026-11-16', '2026-11-29')
    expect(dates(result.weekdays)).toEqual(['2026-11-16', '2026-11-19', '2026-11-25'])
    expect(dates(result.weekendReminders)).toEqual(['2026-11-22', '2026-11-28'])
  })

  it('a cada 1 dia: todos os dias, fim de semana como lembrete', () => {
    const result = calculateOccurrences(every(1, '2026-11-16'), '2026-11-16', '2026-11-22')
    expect(result.weekdays).toHaveLength(5)
    expect(dates(result.weekendReminders)).toEqual(['2026-11-21', '2026-11-22'])
  })

  it('mantém a fase da série quando a janela começa no meio dela', () => {
    // Série de 3 em 3 dias desde 16/11: 16, 19, 22, 25, 28... A janela começa em 20/11.
    const result = calculateOccurrences(every(3, '2026-11-16'), '2026-11-20', '2026-11-30')
    expect(dates(result.weekdays)).toEqual(['2026-11-25'])
    expect(dates(result.weekendReminders)).toEqual(['2026-11-22', '2026-11-28'])
  })

  it('não gera ocorrências antes da data inicial', () => {
    const result = calculateOccurrences(every(2, '2026-11-25'), '2026-11-16', '2026-11-26')
    expect(dates(result.weekdays)).toEqual(['2026-11-25'])
  })

  it('atravessa a virada de ano e o ano bissexto', () => {
    const newYear = calculateOccurrences(every(15, '2026-12-20'), '2026-12-20', '2027-02-01')
    expect(dates([...newYear.weekdays, ...newYear.weekendReminders]).sort()).toEqual(['2026-12-20', '2027-01-04', '2027-01-19'])
    const leap = calculateOccurrences(every(1, '2028-02-28'), '2028-02-28', '2028-03-01')
    expect([...leap.weekdays, ...leap.weekendReminders].map((o) => o.date).sort()).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ])
  })

  it('várias vezes ao dia: cada vez é uma ocorrência, sem hora primeiro', () => {
    const result = calculateOccurrences(weekly([2], ['20:00', null, '08:00']), '2026-11-17', '2026-11-17')
    expect(result.weekdays).toEqual([
      { date: '2026-11-17', time: null },
      { date: '2026-11-17', time: '08:00' },
      { date: '2026-11-17', time: '20:00' },
    ])
  })

  it('intervalo invertido devolve vazio', () => {
    const result = calculateOccurrences(weekly([1]), '2026-11-30', '2026-11-16')
    expect(result).toEqual({ weekdays: [], weekendReminders: [] })
  })

  it('não depende do fuso do ambiente (datas em UTC puro)', () => {
    const result = calculateOccurrences(weekly([1]), '2026-03-08', '2026-03-09')
    expect(dates(result.weekdays)).toEqual(['2026-03-09'])
  })
})

describe('addDaysIso', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(addDaysIso('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('upcomingOccurrences', () => {
  it('junta dias úteis e lembretes em ordem e marca os lembretes', () => {
    const upcoming = upcomingOccurrences(every(3, '2026-11-16'), '2026-11-16', 4)
    expect(upcoming.map((o) => [o.date, o.reminder])).toEqual([
      ['2026-11-16', false],
      ['2026-11-19', false],
      ['2026-11-22', true],
      ['2026-11-25', false],
    ])
  })

  it('respeita o limite', () => {
    expect(upcomingOccurrences(weekly([1, 2, 3, 4, 5]), '2026-11-16', 2)).toHaveLength(2)
  })
})
