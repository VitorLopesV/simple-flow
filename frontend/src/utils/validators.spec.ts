import { describe, expect, it, vi } from 'vitest'

import {
  compose,
  hexColor,
  isoDate,
  validEmail,
  maxLength,
  minLength,
  numberBetween,
  required,
  digitsOnly,
  optionalPhone,
  positiveAmount,
} from '@/utils/validators'

describe('required', () => {
  it.each([null, undefined, '', '   ', []])('rejeita %j', (value) => {
    expect(required()(value)).toBe('Campo é obrigatório.')
  })

  it.each([0, false, 'a', [1]])('aceita %j', (value) => {
    expect(required()(value)).toBe(true)
  })

  it('usa o nome do campo customizado', () => {
    expect(required('Nome')('')).toBe('Nome é obrigatório.')
  })
})

describe('minLength', () => {
  it('valida o limite mínimo', () => {
    expect(minLength(3)('ab')).toBe('Campo deve ter ao menos 3 caracteres.')
    expect(minLength(3)('abc')).toBe(true)
  })

  it('ignora espaços nas pontas', () => {
    expect(minLength(3)('  ab  ')).toBe('Campo deve ter ao menos 3 caracteres.')
    expect(minLength(3)(null)).toBe('Campo deve ter ao menos 3 caracteres.')
  })

  it('usa o nome do campo customizado', () => {
    expect(minLength(3, 'Nome')('a')).toBe('Nome deve ter ao menos 3 caracteres.')
  })
})

describe('maxLength', () => {
  it('valida o limite máximo', () => {
    expect(maxLength(5)('abcdef')).toBe('Campo deve ter no máximo 5 caracteres.')
    expect(maxLength(5)('abcde')).toBe(true)
    expect(maxLength(5)(undefined)).toBe(true)
  })

  it('usa o nome do campo customizado', () => {
    expect(maxLength(1, 'Nome')('ab')).toBe('Nome deve ter no máximo 1 caracteres.')
  })
})

describe('positiveAmount', () => {
  it.each(['0', '', null])('rejeita zero/vazio %j', (value) => {
    expect(positiveAmount()(value)).toBe('Valor deve ser maior que zero.')
  })

  it('rejeita negativo', () => {
    expect(positiveAmount()('-1')).toBe('Valor deve ser maior que zero.')
  })

  it('aceita texto formatado', () => {
    expect(positiveAmount()('R$ 10,00')).toBe(true)
  })

  it('respeita o limite superior', () => {
    expect(positiveAmount()('999.999.999,00')).toBe(true)
    expect(positiveAmount()('1.000.000.000,00')).toBe('Valor excede o limite permitido.')
  })

  it('usa o nome do campo customizado', () => {
    expect(positiveAmount('Saldo')('0')).toBe('Saldo deve ser maior que zero.')
  })
})

describe('isoDate', () => {
  it('aceita data válida', () => {
    expect(isoDate()('2026-08-15')).toBe(true)
    expect(isoDate()('2028-02-29')).toBe(true)
  })

  it.each(['15/08/2026', '', '2026-8-15'])('rejeita formato %j', (value) => {
    expect(isoDate()(value)).toBe('Data inválida.')
  })

  it.each(['2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00'])(
    'rejeita data inexistente %s',
    (value) => {
      expect(isoDate()(value)).toBe('Data inválida.')
    },
  )

  it('usa o nome do campo customizado', () => {
    expect(isoDate('Vencimento')('x')).toBe('Vencimento inválida.')
  })
})

describe('numberBetween', () => {
  it('trata os limites como inclusivos', () => {
    expect(numberBetween(1, 31)('1')).toBe(true)
    expect(numberBetween(1, 31)(31)).toBe(true)
    expect(numberBetween(1, 31)('0')).toBe('Valor deve estar entre 1 e 31.')
    expect(numberBetween(1, 31)('32')).toBe('Valor deve estar entre 1 e 31.')
  })

  it('rejeita não numérico', () => {
    expect(numberBetween(1, 31)('x')).toBe('Valor deve ser um número.')
  })

  it('usa o nome do campo customizado', () => {
    expect(numberBetween(1, 31, 'Dia')('40')).toBe('Dia deve estar entre 1 e 31.')
  })
})

describe('digitsOnly', () => {
  it('exige exatamente a quantidade de dígitos', () => {
    expect(digitsOnly(4)('1234')).toBe(true)
    expect(digitsOnly(4)('123')).toBe('Campo deve conter 4 dígitos.')
    expect(digitsOnly(4)('12345')).toBe('Campo deve conter 4 dígitos.')
    expect(digitsOnly(4)('12a4')).toBe('Campo deve conter 4 dígitos.')
    expect(digitsOnly(4)(null)).toBe('Campo deve conter 4 dígitos.')
  })

  it('usa o nome do campo customizado', () => {
    expect(digitsOnly(4, 'Final')('1')).toBe('Final deve conter 4 dígitos.')
  })
})

describe('hexColor', () => {
  it.each(['#fff', '#FFFFFF', '#1a2B3c'])('aceita %s', (value) => {
    expect(hexColor()(value)).toBe(true)
  })

  it.each(['fff', '#ffff', '#gggggg', '', null])('rejeita %j', (value) => {
    expect(hexColor()(value)).toBe('Cor inválida.')
  })

  it('usa o nome do campo customizado', () => {
    expect(hexColor('Cor da categoria')('x')).toBe('Cor da categoria inválida.')
  })
})

describe('compose', () => {
  it('devolve a primeira mensagem de erro e não executa as regras seguintes', () => {
    const first = vi.fn(() => true as const)
    const second = vi.fn(() => 'erro da segunda')
    const third = vi.fn(() => 'erro da terceira')

    expect(compose(first, second, third)('x')).toBe('erro da segunda')
    expect(first).toHaveBeenCalledWith('x')
    expect(second).toHaveBeenCalledTimes(1)
    expect(third).not.toHaveBeenCalled()
  })

  it('devolve true quando todas as regras são válidas', () => {
    expect(compose(required('Nome'), minLength(2, 'Nome'))('ab')).toBe(true)
  })

  it('devolve true sem regras', () => {
    expect(compose()('x')).toBe(true)
  })
})

describe('validEmail', () => {
  it.each(['a@b.co', ' ana@exemplo.com '])('aceita %j', (value) => {
    expect(validEmail()(value)).toBe(true)
  })

  it.each(['', 'sem-arroba', 'a@b', 'a b@c.com', null])('rejeita %j', (value) => {
    expect(validEmail()(value)).toBe('E-mail inválido.')
  })
})

describe('optionalPhone', () => {
  it.each(['', null, undefined, '(11) 99999-8888', '1133334444'])('aceita %j', (value) => {
    expect(optionalPhone()(value)).toBe(true)
  })

  it.each(['123', '(11) 9999-88', '119999988887'])('rejeita %j', (value) => {
    expect(optionalPhone()(value)).toBe('Telefone inválido.')
  })
})
