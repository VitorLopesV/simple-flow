import { afterEach, describe, expect, it, vi } from 'vitest'

import { contemBusca, delay, normalizar, paginar } from '@/services/mock/utils'

afterEach(() => {
  vi.useRealTimers()
})

const itens = Array.from({ length: 20 }, (_, i) => i + 1)

describe('paginar', () => {
  it('devolve a primeira página cheia', () => {
    const resultado = paginar(itens, { page: 1, pageSize: 8 })
    expect(resultado.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(resultado.page).toBe(1)
    expect(resultado.pageSize).toBe(8)
    expect(resultado.total).toBe(20)
    expect(resultado.totalPages).toBe(3)
  })

  it('devolve a última página parcial', () => {
    const resultado = paginar(itens, { page: 3, pageSize: 8 })
    expect(resultado.items).toEqual([17, 18, 19, 20])
    expect(resultado.totalPages).toBe(3)
  })

  it.each([0, -3])('trata a página %d como 1', (page) => {
    const resultado = paginar(itens, { page, pageSize: 8 })
    expect(resultado.page).toBe(1)
    expect(resultado.items).toHaveLength(8)
  })

  it('limita página acima do total à última', () => {
    const resultado = paginar(itens, { page: 99, pageSize: 8 })
    expect(resultado.page).toBe(3)
    expect(resultado.items).toEqual([17, 18, 19, 20])
  })

  it('lida com lista vazia', () => {
    const resultado = paginar([], { page: 5, pageSize: 8 })
    expect(resultado.items).toEqual([])
    expect(resultado.totalPages).toBe(1)
    expect(resultado.total).toBe(0)
    expect(resultado.page).toBe(1)
  })
})

describe('normalizar', () => {
  it('remove acentos, caixa e espaços das pontas', () => {
    expect(normalizar('  AÇÃO  ')).toBe('acao')
  })
})

describe('contemBusca', () => {
  it.each(['', '   ', null, undefined])('aceita busca vazia %j', (busca) => {
    expect(contemBusca('qualquer texto', busca)).toBe(true)
  })

  it('ignora acento e caixa', () => {
    expect(contemBusca('Alimentação', 'alimentacao')).toBe(true)
    expect(contemBusca('alimentacao', 'ALIMENTAÇÃO')).toBe(true)
    expect(contemBusca('Supermercado Extra', 'merc')).toBe(true)
  })

  it('devolve false sem ocorrência', () => {
    expect(contemBusca('Alimentação', 'transporte')).toBe(false)
  })
})

describe('delay', () => {
  it('resolve o valor somente após o tempo informado', async () => {
    vi.useFakeTimers()
    const resolvido = vi.fn()
    const promessa = delay('x', 100).then(resolvido)

    await vi.advanceTimersByTimeAsync(99)
    expect(resolvido).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await promessa
    expect(resolvido).toHaveBeenCalledWith('x')
  })
})
