import { describe, expect, it } from 'vitest'

import {
  calcularVariacao,
  formatCurrency,
  formatCurrencyCompact,
  formatDecimal,
  formatPercent,
  parseCurrency,
} from '@/utils/currencyFormatter'

// O Intl separa o símbolo do valor com espaço não separável (NBSP).
const semNbsp = (texto: string) => texto.replace(/ /g, ' ')

describe('parseCurrency', () => {
  it.each(['1.234,56', '1234,56', '1234.56', 'R$ 1.234,56'])('converte %s para 1234.56', (entrada) => {
    expect(parseCurrency(entrada)).toBe(1234.56)
  })

  it('devolve número como está', () => {
    expect(parseCurrency(99.9)).toBe(99.9)
  })

  it.each(['', null, undefined, 'abc'])('devolve 0 para %j', (entrada) => {
    expect(parseCurrency(entrada)).toBe(0)
  })

  it('preserva sinal negativo', () => {
    expect(parseCurrency('-50,00')).toBe(-50)
  })

  it("trata ponto sem vírgula em grupos de 3 dígitos como milhar ('1.234' -> 1234)", () => {
    expect(parseCurrency('1.234')).toBe(1234)
    expect(parseCurrency('1.234.567')).toBe(1234567)
  })

  it('mantém ponto como decimal quando não forma grupos de milhar', () => {
    expect(parseCurrency('12.5')).toBe(12.5)
    expect(parseCurrency('1234.56')).toBe(1234.56)
  })
})

describe('calcularVariacao', () => {
  it('calcula variação positiva e negativa', () => {
    expect(calcularVariacao(150, 100)).toBe(0.5)
    expect(calcularVariacao(50, 100)).toBe(-0.5)
  })

  it('protege contra divisão por zero', () => {
    expect(calcularVariacao(10, 0)).toBe(1)
    expect(calcularVariacao(0, 0)).toBe(0)
  })

  it('usa valor absoluto do anterior no divisor', () => {
    expect(calcularVariacao(-50, -100)).toBe(0.5)
    expect(calcularVariacao(0, -100)).toBe(1)
  })
})

describe('formatadores', () => {
  it('formatCurrency usa padrão pt-BR', () => {
    expect(semNbsp(formatCurrency(1234.5))).toContain('1.234,50')
    expect(semNbsp(formatCurrency(1234.5))).toBe('R$ 1.234,50')
  })

  it.each([null, undefined])('formatCurrency(%j) resulta em 0,00', (entrada) => {
    expect(semNbsp(formatCurrency(entrada))).toContain('0,00')
  })

  it('formatCurrencyCompact abrevia valores grandes sem NaN', () => {
    expect(formatCurrencyCompact(1234567)).not.toContain('NaN')
    expect(semNbsp(formatCurrencyCompact(1234567))).toContain('1,2')
    expect(() => formatCurrencyCompact(null)).not.toThrow()
  })

  it('formatPercent recebe fração', () => {
    expect(formatPercent(0.1234)).toBe('12,3%')
    expect(formatPercent(null)).toBe('0,0%')
  })

  it('formatDecimal não traz símbolo', () => {
    expect(formatDecimal(1234.5)).toBe('1.234,50')
    expect(formatDecimal(undefined)).toBe('0,00')
  })
})
