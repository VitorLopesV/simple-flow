import { describe, expect, it, vi } from 'vitest'

import {
  compor,
  corHexadecimal,
  dataISO,
  emailValido,
  maximoCaracteres,
  minimoCaracteres,
  numeroEntre,
  obrigatorio,
  somenteDigitos,
  telefoneOpcional,
  valorMonetarioPositivo,
} from '@/utils/validators'

describe('obrigatorio', () => {
  it.each([null, undefined, '', '   ', []])('rejeita %j', (valor) => {
    expect(obrigatorio()(valor)).toBe('Campo é obrigatório.')
  })

  it.each([0, false, 'a', [1]])('aceita %j', (valor) => {
    expect(obrigatorio()(valor)).toBe(true)
  })

  it('usa o nome do campo customizado', () => {
    expect(obrigatorio('Nome')('')).toBe('Nome é obrigatório.')
  })
})

describe('minimoCaracteres', () => {
  it('valida o limite mínimo', () => {
    expect(minimoCaracteres(3)('ab')).toBe('Campo deve ter ao menos 3 caracteres.')
    expect(minimoCaracteres(3)('abc')).toBe(true)
  })

  it('ignora espaços nas pontas', () => {
    expect(minimoCaracteres(3)('  ab  ')).toBe('Campo deve ter ao menos 3 caracteres.')
    expect(minimoCaracteres(3)(null)).toBe('Campo deve ter ao menos 3 caracteres.')
  })

  it('usa o nome do campo customizado', () => {
    expect(minimoCaracteres(3, 'Nome')('a')).toBe('Nome deve ter ao menos 3 caracteres.')
  })
})

describe('maximoCaracteres', () => {
  it('valida o limite máximo', () => {
    expect(maximoCaracteres(5)('abcdef')).toBe('Campo deve ter no máximo 5 caracteres.')
    expect(maximoCaracteres(5)('abcde')).toBe(true)
    expect(maximoCaracteres(5)(undefined)).toBe(true)
  })

  it('usa o nome do campo customizado', () => {
    expect(maximoCaracteres(1, 'Nome')('ab')).toBe('Nome deve ter no máximo 1 caracteres.')
  })
})

describe('valorMonetarioPositivo', () => {
  it.each(['0', '', null])('rejeita zero/vazio %j', (valor) => {
    expect(valorMonetarioPositivo()(valor)).toBe('Valor deve ser maior que zero.')
  })

  it('rejeita negativo', () => {
    expect(valorMonetarioPositivo()('-1')).toBe('Valor deve ser maior que zero.')
  })

  it('aceita texto formatado', () => {
    expect(valorMonetarioPositivo()('R$ 10,00')).toBe(true)
  })

  it('respeita o limite superior', () => {
    expect(valorMonetarioPositivo()('999.999.999,00')).toBe(true)
    expect(valorMonetarioPositivo()('1.000.000.000,00')).toBe('Valor excede o limite permitido.')
  })

  it('usa o nome do campo customizado', () => {
    expect(valorMonetarioPositivo('Saldo')('0')).toBe('Saldo deve ser maior que zero.')
  })
})

describe('dataISO', () => {
  it('aceita data válida', () => {
    expect(dataISO()('2026-08-15')).toBe(true)
    expect(dataISO()('2028-02-29')).toBe(true)
  })

  it.each(['15/08/2026', '', '2026-8-15'])('rejeita formato %j', (valor) => {
    expect(dataISO()(valor)).toBe('Data inválida.')
  })

  it.each(['2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00'])(
    'rejeita data inexistente %s',
    (valor) => {
      expect(dataISO()(valor)).toBe('Data inválida.')
    },
  )

  it('usa o nome do campo customizado', () => {
    expect(dataISO('Vencimento')('x')).toBe('Vencimento inválida.')
  })
})

describe('numeroEntre', () => {
  it('trata os limites como inclusivos', () => {
    expect(numeroEntre(1, 31)('1')).toBe(true)
    expect(numeroEntre(1, 31)(31)).toBe(true)
    expect(numeroEntre(1, 31)('0')).toBe('Valor deve estar entre 1 e 31.')
    expect(numeroEntre(1, 31)('32')).toBe('Valor deve estar entre 1 e 31.')
  })

  it('rejeita não numérico', () => {
    expect(numeroEntre(1, 31)('x')).toBe('Valor deve ser um número.')
  })

  it('usa o nome do campo customizado', () => {
    expect(numeroEntre(1, 31, 'Dia')('40')).toBe('Dia deve estar entre 1 e 31.')
  })
})

describe('somenteDigitos', () => {
  it('exige exatamente a quantidade de dígitos', () => {
    expect(somenteDigitos(4)('1234')).toBe(true)
    expect(somenteDigitos(4)('123')).toBe('Campo deve conter 4 dígitos.')
    expect(somenteDigitos(4)('12345')).toBe('Campo deve conter 4 dígitos.')
    expect(somenteDigitos(4)('12a4')).toBe('Campo deve conter 4 dígitos.')
    expect(somenteDigitos(4)(null)).toBe('Campo deve conter 4 dígitos.')
  })

  it('usa o nome do campo customizado', () => {
    expect(somenteDigitos(4, 'Final')('1')).toBe('Final deve conter 4 dígitos.')
  })
})

describe('corHexadecimal', () => {
  it.each(['#fff', '#FFFFFF', '#1a2B3c'])('aceita %s', (valor) => {
    expect(corHexadecimal()(valor)).toBe(true)
  })

  it.each(['fff', '#ffff', '#gggggg', '', null])('rejeita %j', (valor) => {
    expect(corHexadecimal()(valor)).toBe('Cor inválida.')
  })

  it('usa o nome do campo customizado', () => {
    expect(corHexadecimal('Cor da categoria')('x')).toBe('Cor da categoria inválida.')
  })
})

describe('compor', () => {
  it('devolve a primeira mensagem de erro e não executa as regras seguintes', () => {
    const primeira = vi.fn(() => true as const)
    const segunda = vi.fn(() => 'erro da segunda')
    const terceira = vi.fn(() => 'erro da terceira')

    expect(compor(primeira, segunda, terceira)('x')).toBe('erro da segunda')
    expect(primeira).toHaveBeenCalledWith('x')
    expect(segunda).toHaveBeenCalledTimes(1)
    expect(terceira).not.toHaveBeenCalled()
  })

  it('devolve true quando todas as regras são válidas', () => {
    expect(compor(obrigatorio('Nome'), minimoCaracteres(2, 'Nome'))('ab')).toBe(true)
  })

  it('devolve true sem regras', () => {
    expect(compor()('x')).toBe(true)
  })
})

describe('emailValido', () => {
  it.each(['a@b.co', ' ana@exemplo.com '])('aceita %j', (valor) => {
    expect(emailValido()(valor)).toBe(true)
  })

  it.each(['', 'sem-arroba', 'a@b', 'a b@c.com', null])('rejeita %j', (valor) => {
    expect(emailValido()(valor)).toBe('E-mail inválido.')
  })
})

describe('telefoneOpcional', () => {
  it.each(['', null, undefined, '(11) 99999-8888', '1133334444'])('aceita %j', (valor) => {
    expect(telefoneOpcional()(valor)).toBe(true)
  })

  it.each(['123', '(11) 9999-88', '119999988887'])('rejeita %j', (valor) => {
    expect(telefoneOpcional()(valor)).toBe('Telefone inválido.')
  })
})
