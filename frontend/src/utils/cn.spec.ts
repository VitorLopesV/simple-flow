import { describe, expect, it } from 'vitest'

import { cn } from '@/utils/cn'

describe('cn', () => {
  it('junta classes com espaço', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('ignora valores falsy', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('achata arrays aninhados', () => {
    expect(cn('a', ['b', ['c']])).toBe('a b c')
  })

  it('não gera espaços sobrando com array vazio ou só com falsy', () => {
    expect(cn('a', [], 'b')).toBe('a b')
    expect(cn([], [false, null, [undefined, '']])).toBe('')
    expect(cn('a', [false, null])).toBe('a')
  })

  it('preserva a ordem de aplicação', () => {
    expect(cn('p-2', ['text-sm'], 'p-4')).toBe('p-2 text-sm p-4')
  })
})
