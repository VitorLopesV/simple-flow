import { describe, expect, it } from 'vitest'

import { apenasDigitosTelefone, formatarTelefone } from './telefoneFormatter'

describe('formatarTelefone', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['11', '11'],
    ['119', '(11) 9'],
    ['1199999', '(11) 9999-9'],
    ['1133334444', '(11) 3333-4444'],
    ['11999998888', '(11) 99999-8888'],
    ['(11) 99999-8888', '(11) 99999-8888'],
    ['1199999888877', '(11) 99999-8888'],
  ])('formata %j como %j', (entrada, esperado) => {
    expect(formatarTelefone(entrada)).toBe(esperado)
  })
})

describe('apenasDigitosTelefone', () => {
  it('remove a máscara e limita a 11 dígitos', () => {
    expect(apenasDigitosTelefone('(11) 99999-8888')).toBe('11999998888')
    expect(apenasDigitosTelefone('119999988889999')).toBe('11999998888')
  })
})
