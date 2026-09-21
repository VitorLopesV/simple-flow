import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  addMeses,
  dentroDoPeriodo,
  diaDoPeriodo,
  diasAte,
  formatDate,
  formatDateShort,
  formatPeriodo,
  fromCompetencia,
  labelCurtoPeriodo,
  mascararDataBR,
  mesmoPeriodo,
  paraISODataBR,
  paraMascaraDataBR,
  toCompetencia,
  toDate,
  toISODate,
  ultimoDiaDoMes,
  ultimosPeriodos,
} from '@/utils/dateFormatter'

afterEach(() => {
  vi.useRealTimers()
})

describe('toDate / toISODate', () => {
  it('converte ISO para Date local ao meio-dia', () => {
    const data = toDate('2026-08-15')
    expect(data.getFullYear()).toBe(2026)
    expect(data.getMonth()).toBe(7)
    expect(data.getDate()).toBe(15)
    expect(data.getHours()).toBe(12)
  })

  it.each(['2026-08-15', '2026-01-01', '2026-12-31'])('faz round-trip de %s', (iso) => {
    expect(toISODate(toDate(iso))).toBe(iso)
  })
})

describe('formatDate / formatDateShort / paraMascaraDataBR', () => {
  it('formata datas válidas', () => {
    expect(formatDate('2026-08-15')).toBe('15/08/2026')
    expect(formatDateShort('2026-08-15')).toBe('15 de ago.')
    expect(paraMascaraDataBR('2026-08-15')).toBe('15/08/2026')
  })

  it.each([null, undefined, ''])('trata %j', (entrada) => {
    expect(formatDate(entrada)).toBe('—')
    expect(formatDateShort(entrada)).toBe('—')
    expect(paraMascaraDataBR(entrada)).toBe('')
  })
})

describe('mascararDataBR / paraISODataBR', () => {
  it('aplica a máscara completa', () => {
    expect(mascararDataBR('15082026')).toBe('15/08/2026')
  })

  it('aplica a máscara em entrada parcial', () => {
    expect(mascararDataBR('150')).toBe('15/0')
  })

  it('ignora letras e corta em 8 dígitos', () => {
    expect(mascararDataBR('1a5b0c8d2026')).toBe('15/08/2026')
    expect(mascararDataBR('150820261234')).toBe('15/08/2026')
  })

  it('converte máscara completa para ISO e devolve null se incompleta', () => {
    expect(paraISODataBR('15/08/2026')).toBe('2026-08-15')
    expect(paraISODataBR('15/08/20')).toBeNull()
    expect(paraISODataBR('')).toBeNull()
  })
})

describe('competência', () => {
  it('converte ida e volta', () => {
    expect(toCompetencia({ mes: 8, ano: 2026 })).toBe('2026-08')
    expect(fromCompetencia('2026-08')).toEqual({ mes: 8, ano: 2026 })
  })
})

describe('addMeses', () => {
  it('avança de dezembro para janeiro do ano seguinte', () => {
    expect(addMeses({ mes: 12, ano: 2026 }, 1)).toEqual({ mes: 1, ano: 2027 })
  })

  it('volta de janeiro para dezembro do ano anterior', () => {
    expect(addMeses({ mes: 1, ano: 2026 }, -1)).toEqual({ mes: 12, ano: 2025 })
  })

  it('soma e subtrai múltiplos anos', () => {
    expect(addMeses({ mes: 8, ano: 2026 }, 24)).toEqual({ mes: 8, ano: 2028 })
    expect(addMeses({ mes: 8, ano: 2026 }, -13)).toEqual({ mes: 7, ano: 2025 })
  })
})

describe('ultimosPeriodos', () => {
  it('devolve 6 períodos do mais antigo ao atual, atravessando a virada de ano', () => {
    const lista = ultimosPeriodos({ mes: 2, ano: 2026 }, 6)
    expect(lista).toHaveLength(6)
    expect(lista[0]).toEqual({ mes: 9, ano: 2025 })
    expect(lista[3]).toEqual({ mes: 12, ano: 2025 })
    expect(lista[4]).toEqual({ mes: 1, ano: 2026 })
    expect(lista[5]).toEqual({ mes: 2, ano: 2026 })
  })
})

describe('ultimoDiaDoMes / diaDoPeriodo', () => {
  it('calcula o último dia de cada mês', () => {
    expect(ultimoDiaDoMes({ mes: 2, ano: 2026 })).toBe(28)
    expect(ultimoDiaDoMes({ mes: 2, ano: 2028 })).toBe(29)
    expect(ultimoDiaDoMes({ mes: 4, ano: 2026 })).toBe(30)
    expect(ultimoDiaDoMes({ mes: 1, ano: 2026 })).toBe(31)
  })

  it('limita o dia ao último dia do mês', () => {
    expect(diaDoPeriodo({ mes: 2, ano: 2026 }, 31)).toBe('2026-02-28')
    expect(diaDoPeriodo({ mes: 8, ano: 2026 }, 5)).toBe('2026-08-05')
  })
})

describe('períodos', () => {
  it('dentroDoPeriodo', () => {
    expect(dentroDoPeriodo('2026-08-15', { mes: 8, ano: 2026 })).toBe(true)
    expect(dentroDoPeriodo('2026-08-15', { mes: 7, ano: 2026 })).toBe(false)
    expect(dentroDoPeriodo('2026-08-15', { mes: 8, ano: 2025 })).toBe(false)
  })

  it('mesmoPeriodo', () => {
    expect(mesmoPeriodo({ mes: 8, ano: 2026 }, { mes: 8, ano: 2026 })).toBe(true)
    expect(mesmoPeriodo({ mes: 8, ano: 2026 }, { mes: 9, ano: 2026 })).toBe(false)
  })

  it('labels', () => {
    expect(labelCurtoPeriodo({ mes: 8, ano: 2026 })).toBe('ago/26')
    expect(formatPeriodo({ mes: 8, ano: 2026 })).toBe('Agosto de 2026')
  })
})

describe('diasAte', () => {
  it('conta dias a partir de hoje com relógio controlado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 15, 9, 30))
    expect(diasAte('2026-08-15')).toBe(0)
    expect(diasAte('2026-08-16')).toBe(1)
    expect(diasAte('2026-08-14')).toBe(-1)
  })

  it('não depende da hora do dia', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 15, 23, 59))
    expect(diasAte('2026-08-15')).toBe(0)
    expect(diasAte('2026-08-16')).toBe(1)
  })
})
