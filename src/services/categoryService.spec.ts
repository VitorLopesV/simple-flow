import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockDb } from '@/services/mock'
import { categoryService } from '@/services/categoryService'
import type { Category, CategoryType } from '@/types/category'
import type { CategoryDto } from '@/types/dto'

const http = vi.hoisted(() => ({ useMock: true, get: vi.fn() }))

vi.mock('@/services/http', () => ({
  get USE_MOCK() {
    return http.useMock
  },
  MOCK_LATENCY: 0,
  http: { get: http.get },
}))

let sequence = 0

/** Categoria no formato da API (campos em português). */
function categoryDto(name: string, type: CategoryType = 'CONTA_FIXA'): CategoryDto {
  sequence += 1
  return { id: `cat_${sequence}`, nome: name, tipo: type, movimento: 'SAIDA', cor: '#000000' }
}

const names = (list: Category[]) => list.map((c) => c.name)

/** Modo API real: o backend entrega `dados` e o service reordena no cliente. */
async function listFromApi(data: CategoryDto[]): Promise<Category[]> {
  http.useMock = false
  http.get.mockResolvedValue({ data })
  return categoryService.list()
}

beforeEach(() => {
  http.useMock = true
  http.get.mockReset()
})

describe('list (API real)', () => {
  it('chama GET /categorias', async () => {
    await listFromApi([])

    expect(http.get).toHaveBeenCalledWith('/categorias')
  })

  it('converte os campos da API para o formato de domínio', async () => {
    const [result] = await listFromApi([
      { id: 'cat_x', nome: 'Casa', tipo: 'CONTA_FIXA', movimento: 'SAIDA', cor: '#123456' },
    ])

    expect(result).toEqual({
      id: 'cat_x',
      name: 'Casa',
      type: 'CONTA_FIXA',
      movement: 'SAIDA',
      color: '#123456',
    })
  })

  it('ordena alfabeticamente respeitando acentos em pt-BR', async () => {
    const result = await listFromApi([
      categoryDto('Casa'),
      categoryDto('Benefício'),
      categoryDto('Água'),
    ])

    expect(names(result)).toEqual(['Água', 'Benefício', 'Casa'])
  })

  it('manda para o fim a categoria com tipo OUTROS, mesmo com nome começando em A', async () => {
    const result = await listFromApi([
      categoryDto('Almoço extra', 'OUTROS'),
      categoryDto('Zebra'),
      categoryDto('Bolsa'),
    ])

    expect(names(result)).toEqual(['Bolsa', 'Zebra', 'Almoço extra'])
  })

  it('manda para o fim a categoria cujo nome casa /^outr/i', async () => {
    const result = await listFromApi([
      categoryDto('Outras receitas', 'RENDA'),
      categoryDto('outros gastos', 'CONTA_VARIAVEL'),
      categoryDto('Salário', 'RENDA'),
      categoryDto('Zebra'),
    ])

    expect(names(result)).toEqual(['Salário', 'Zebra', 'Outras receitas', 'outros gastos'])
  })

  it('mantém ordem alfabética entre as catch-all', async () => {
    const result = await listFromApi([
      categoryDto('Outros', 'OUTROS'),
      categoryDto('Aaa catch-all', 'OUTROS'),
      categoryDto('Outras receitas', 'RENDA'),
      categoryDto('Casa'),
    ])

    expect(names(result)).toEqual(['Casa', 'Aaa catch-all', 'Outras receitas', 'Outros'])
  })

  it('não depende da ordem em que a API entrega os dados', async () => {
    const data = [
      categoryDto('Água'),
      categoryDto('Benefício', 'RENDA'),
      categoryDto('Casa'),
      categoryDto('Outras receitas', 'RENDA'),
      categoryDto('Outros', 'OUTROS'),
    ]
    const expected = ['Água', 'Benefício', 'Casa', 'Outras receitas', 'Outros']

    expect(names(await listFromApi([...data]))).toEqual(expected)
    expect(names(await listFromApi([...data].reverse()))).toEqual(expected)
    expect(names(await listFromApi([data[3]!, data[0]!, data[4]!, data[2]!, data[1]!]))).toEqual(
      expected,
    )
  })

  it('não muta o array devolvido pela API', async () => {
    const data = [categoryDto('Zebra'), categoryDto('Água'), categoryDto('Outros', 'OUTROS')]
    const originalOrder = [...data]

    const result = await listFromApi(data)

    expect(result).not.toBe(data)
    expect(data).toEqual(originalOrder)
    expect(names(result)).toEqual(['Água', 'Zebra', 'Outros'])
  })
})

describe('list (mock)', () => {
  it('não chama a API', async () => {
    await categoryService.list()

    expect(http.get).not.toHaveBeenCalled()
  })

  it('devolve as categorias do banco com o catch-all por último e sem NaN de ordenação', async () => {
    const db = await mockDb()

    const result = await categoryService.list()

    expect(result).toHaveLength(db.categories.length)
    const catchAll = (c: Category) => c.type === 'OUTROS' || /^outr/i.test(c.name)
    const firstCatchAll = result.findIndex(catchAll)
    expect(firstCatchAll).toBeGreaterThan(-1)
    expect(result.slice(firstCatchAll).every(catchAll)).toBe(true)
    expect(result.slice(0, firstCatchAll).some(catchAll)).toBe(false)

    const regular = result.slice(0, firstCatchAll).map((c) => c.name)
    expect(regular).toEqual([...regular].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })

  it('não expõe o array do banco nem seus objetos por referência', async () => {
    const db = await mockDb()
    const dbOrder = db.categories.map((c) => c.id)
    const originalName = db.categories[0]!.name

    const result = await categoryService.list()
    result[0]!.name = 'Alterada no consumidor'
    result.length = 0

    expect(db.categories.map((c) => c.id)).toEqual(dbOrder)
    expect(db.categories[0]!.name).toBe(originalName)
  })

  it('não reordena o array do banco', async () => {
    const db = await mockDb()
    const before = db.categories.map((c) => c.id)

    await categoryService.list()

    expect(db.categories.map((c) => c.id)).toEqual(before)
  })
})
