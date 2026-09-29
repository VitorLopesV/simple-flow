import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  addMonths,
  isWithinPeriod,
  dayInPeriod,
  daysUntil,
  formatDate,
  formatDateShort,
  formatPeriod,
  fromReferenceMonth,
  shortPeriodLabel,
  maskBrDate,
  isSamePeriod,
  brDateToISO,
  toBrDateMask,
  toReferenceMonth,
  toDate,
  toISODate,
  lastDayOfMonth,
  lastPeriods,
} from '@/utils/dateFormatter'

afterEach(() => {
  vi.useRealTimers()
})

describe('toDate / toISODate', () => {
  it('converte ISO para Date local ao meio-dia', () => {
    const date = toDate('2026-08-15')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(7)
    expect(date.getDate()).toBe(15)
    expect(date.getHours()).toBe(12)
  })

  it.each(['2026-08-15', '2026-01-01', '2026-12-31'])('faz round-trip de %s', (iso) => {
    expect(toISODate(toDate(iso))).toBe(iso)
  })
})

describe('formatDate / formatDateShort / toBrDateMask', () => {
  it('formata datas válidas', () => {
    expect(formatDate('2026-08-15')).toBe('15/08/2026')
    expect(formatDateShort('2026-08-15')).toBe('15 de ago.')
    expect(toBrDateMask('2026-08-15')).toBe('15/08/2026')
  })

  it.each([null, undefined, ''])('trata %j', (input) => {
    expect(formatDate(input)).toBe('—')
    expect(formatDateShort(input)).toBe('—')
    expect(toBrDateMask(input)).toBe('')
  })
})

describe('maskBrDate / brDateToISO', () => {
  it('aplica a máscara completa', () => {
    expect(maskBrDate('15082026')).toBe('15/08/2026')
  })

  it('aplica a máscara em entrada parcial', () => {
    expect(maskBrDate('150')).toBe('15/0')
  })

  it('ignora letras e corta em 8 dígitos', () => {
    expect(maskBrDate('1a5b0c8d2026')).toBe('15/08/2026')
    expect(maskBrDate('150820261234')).toBe('15/08/2026')
  })

  it('converte máscara completa para ISO e devolve null se incompleta', () => {
    expect(brDateToISO('15/08/2026')).toBe('2026-08-15')
    expect(brDateToISO('15/08/20')).toBeNull()
    expect(brDateToISO('')).toBeNull()
  })
})

describe('competência', () => {
  it('converte ida e volta', () => {
    expect(toReferenceMonth({ month: 8, year: 2026 })).toBe('2026-08')
    expect(fromReferenceMonth('2026-08')).toEqual({ month: 8, year: 2026 })
  })
})

describe('addMonths', () => {
  it('avança de dezembro para janeiro do ano seguinte', () => {
    expect(addMonths({ month: 12, year: 2026 }, 1)).toEqual({ month: 1, year: 2027 })
  })

  it('volta de janeiro para dezembro do ano anterior', () => {
    expect(addMonths({ month: 1, year: 2026 }, -1)).toEqual({ month: 12, year: 2025 })
  })

  it('soma e subtrai múltiplos anos', () => {
    expect(addMonths({ month: 8, year: 2026 }, 24)).toEqual({ month: 8, year: 2028 })
    expect(addMonths({ month: 8, year: 2026 }, -13)).toEqual({ month: 7, year: 2025 })
  })
})

describe('lastPeriods', () => {
  it('devolve 6 períodos do mais antigo ao atual, atravessando a virada de ano', () => {
    const list = lastPeriods({ month: 2, year: 2026 }, 6)
    expect(list).toHaveLength(6)
    expect(list[0]).toEqual({ month: 9, year: 2025 })
    expect(list[3]).toEqual({ month: 12, year: 2025 })
    expect(list[4]).toEqual({ month: 1, year: 2026 })
    expect(list[5]).toEqual({ month: 2, year: 2026 })
  })
})

describe('lastDayOfMonth / dayInPeriod', () => {
  it('calcula o último dia de cada mês', () => {
    expect(lastDayOfMonth({ month: 2, year: 2026 })).toBe(28)
    expect(lastDayOfMonth({ month: 2, year: 2028 })).toBe(29)
    expect(lastDayOfMonth({ month: 4, year: 2026 })).toBe(30)
    expect(lastDayOfMonth({ month: 1, year: 2026 })).toBe(31)
  })

  it('limita o dia ao último dia do mês', () => {
    expect(dayInPeriod({ month: 2, year: 2026 }, 31)).toBe('2026-02-28')
    expect(dayInPeriod({ month: 8, year: 2026 }, 5)).toBe('2026-08-05')
  })
})

describe('períodos', () => {
  it('isWithinPeriod', () => {
    expect(isWithinPeriod('2026-08-15', { month: 8, year: 2026 })).toBe(true)
    expect(isWithinPeriod('2026-08-15', { month: 7, year: 2026 })).toBe(false)
    expect(isWithinPeriod('2026-08-15', { month: 8, year: 2025 })).toBe(false)
  })

  it('isSamePeriod', () => {
    expect(isSamePeriod({ month: 8, year: 2026 }, { month: 8, year: 2026 })).toBe(true)
    expect(isSamePeriod({ month: 8, year: 2026 }, { month: 9, year: 2026 })).toBe(false)
  })

  it('labels', () => {
    expect(shortPeriodLabel({ month: 8, year: 2026 })).toBe('ago/26')
    expect(formatPeriod({ month: 8, year: 2026 })).toBe('Agosto de 2026')
  })
})

describe('daysUntil', () => {
  it('conta dias a partir de hoje com relógio controlado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 15, 9, 30))
    expect(daysUntil('2026-08-15')).toBe(0)
    expect(daysUntil('2026-08-16')).toBe(1)
    expect(daysUntil('2026-08-14')).toBe(-1)
  })

  it('não depende da hora do dia', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 15, 23, 59))
    expect(daysUntil('2026-08-15')).toBe(0)
    expect(daysUntil('2026-08-16')).toBe(1)
  })
})
