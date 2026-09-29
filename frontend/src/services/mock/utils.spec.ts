import { afterEach, describe, expect, it, vi } from 'vitest'

import { delay, matchesSearch, normalize, paginate } from '@/services/mock/utils'

afterEach(() => {
  vi.useRealTimers()
})

const items = Array.from({ length: 20 }, (_, i) => i + 1)

describe('paginate', () => {
  it('devolve a primeira página cheia', () => {
    const result = paginate(items, { page: 1, pageSize: 8 })
    expect(result.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(8)
    expect(result.total).toBe(20)
    expect(result.totalPages).toBe(3)
  })

  it('devolve a última página parcial', () => {
    const result = paginate(items, { page: 3, pageSize: 8 })
    expect(result.items).toEqual([17, 18, 19, 20])
    expect(result.totalPages).toBe(3)
  })

  it.each([0, -3])('trata a página %d como 1', (page) => {
    const result = paginate(items, { page, pageSize: 8 })
    expect(result.page).toBe(1)
    expect(result.items).toHaveLength(8)
  })

  it('limita página acima do total à última', () => {
    const result = paginate(items, { page: 99, pageSize: 8 })
    expect(result.page).toBe(3)
    expect(result.items).toEqual([17, 18, 19, 20])
  })

  it('lida com lista vazia', () => {
    const result = paginate([], { page: 5, pageSize: 8 })
    expect(result.items).toEqual([])
    expect(result.totalPages).toBe(1)
    expect(result.total).toBe(0)
    expect(result.page).toBe(1)
  })
})

describe('normalize', () => {
  it('remove acentos, caixa e espaços das pontas', () => {
    expect(normalize('  AÇÃO  ')).toBe('acao')
  })
})

describe('matchesSearch', () => {
  it.each(['', '   ', null, undefined])('aceita busca vazia %j', (search) => {
    expect(matchesSearch('qualquer texto', search)).toBe(true)
  })

  it('ignora acento e caixa', () => {
    expect(matchesSearch('Alimentação', 'alimentacao')).toBe(true)
    expect(matchesSearch('alimentacao', 'ALIMENTAÇÃO')).toBe(true)
    expect(matchesSearch('Supermercado Extra', 'merc')).toBe(true)
  })

  it('devolve false sem ocorrência', () => {
    expect(matchesSearch('Alimentação', 'transporte')).toBe(false)
  })
})

describe('delay', () => {
  it('resolve o valor somente após o tempo informado', async () => {
    vi.useFakeTimers()
    const resolved = vi.fn()
    const promise = delay('x', 100).then(resolved)

    await vi.advanceTimersByTimeAsync(99)
    expect(resolved).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await promise
    expect(resolved).toHaveBeenCalledWith('x')
  })
})
