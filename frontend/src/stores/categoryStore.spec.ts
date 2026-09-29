import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { categoryService } from '@/services/categoryService'
import { useCategoryStore } from '@/stores/categoryStore'
import type { Category } from '@/types/category'

vi.mock('@/services/categoryService', () => ({
  categoryService: { list: vi.fn() },
}))

const list = vi.mocked(categoryService.list)

const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Despesa Fixa', type: 'CONTA_FIXA', movement: 'SAIDA', color: '#6366f1' },
  { id: 'c2', name: 'Investimento', type: 'INVESTIMENTO', movement: 'SAIDA', color: '#0891b2' },
  { id: 'c3', name: 'Salário', type: 'RENDA', movement: 'ENTRADA', color: '#10b981' },
  { id: 'c4', name: 'Rendimentos', type: 'INVESTIMENTO', movement: 'ENTRADA', color: '#eab308' },
  { id: 'c5', name: 'Outras receitas', type: 'OUTROS', movement: 'ENTRADA', color: '#94a3b8' },
]

function loadedStore() {
  const store = useCategoryStore()
  return store.load().then(() => store)
}

beforeEach(() => {
  setActivePinia(createPinia())
  list.mockReset()
  list.mockResolvedValue(CATEGORIES)
})

describe('estado inicial', () => {
  it('começa vazio e sem carregar', () => {
    const store = useCategoryStore()

    expect(store.categories).toEqual([])
    expect(store.loaded).toBe(false)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })
})

describe('load', () => {
  it('popula as categorias, marca carregado e desliga o loading', async () => {
    const store = useCategoryStore()

    await store.load()

    expect(store.categories).toEqual(CATEGORIES)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('mantém loading verdadeiro enquanto a chamada está em andamento', async () => {
    let finish!: (list: Category[]) => void
    list.mockReturnValue(new Promise<Category[]>((resolve) => (finish = resolve)))
    const store = useCategoryStore()

    const promessa = store.load()
    expect(store.loading).toBe(true)

    finish(CATEGORIES)
    await promessa

    expect(store.loading).toBe(false)
  })

  it('a segunda chamada não chama o service', async () => {
    const store = await loadedStore()

    await store.load()

    expect(list).toHaveBeenCalledTimes(1)
  })

  it('carregar(true) chama o service de novo e atualiza a lista', async () => {
    const store = await loadedStore()
    list.mockResolvedValue([CATEGORIES[0]!])

    await store.load(true)

    expect(list).toHaveBeenCalledTimes(2)
    expect(store.categories).toEqual([CATEGORIES[0]])
  })

  it('falha: guarda a mensagem do erro, não marca carregado e desliga o loading', async () => {
    list.mockRejectedValue(new Error('Servidor fora do ar'))
    const store = useCategoryStore()

    await store.load()

    expect(store.error).toBe('Servidor fora do ar')
    expect(store.loaded).toBe(false)
    expect(store.loading).toBe(false)
    expect(store.categories).toEqual([])
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    list.mockRejectedValue('quebrou')
    const store = useCategoryStore()

    await store.load()

    expect(store.error).toBe('Não foi possível carregar as categorias.')
  })

  it('após uma falha, tentar de novo chama o service e limpa o erro', async () => {
    list.mockRejectedValueOnce(new Error('falhou'))
    const store = useCategoryStore()
    await store.load()
    expect(store.error).toBe('falhou')

    await store.load()

    expect(list).toHaveBeenCalledTimes(2)
    expect(store.error).toBeNull()
    expect(store.loaded).toBe(true)
    expect(store.categories).toEqual(CATEGORIES)
  })
})

describe('incomeCategories / expenseCategories', () => {
  it('filtram por movimento', async () => {
    const store = await loadedStore()

    expect(store.incomeCategories.map((c) => c.id)).toEqual(['c3', 'c4', 'c5'])
    expect(store.expenseCategories.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('ficam vazias antes de carregar', () => {
    const store = useCategoryStore()

    expect(store.incomeCategories).toEqual([])
    expect(store.expenseCategories).toEqual([])
  })
})

describe('options', () => {
  it('SAIDA usa só o nome, sem sufixo de tipo', async () => {
    const store = await loadedStore()

    expect(store.options('SAIDA')).toEqual([
      { label: 'Despesa Fixa', value: 'c1' },
      { label: 'Investimento', value: 'c2' },
    ])
  })

  it('ENTRADA com tipo RENDA usa só o nome; os demais levam o tipo como sufixo', async () => {
    const store = await loadedStore()

    expect(store.options('ENTRADA')).toEqual([
      { label: 'Salário', value: 'c3' },
      { label: 'Rendimentos · Investimentos', value: 'c4' },
      { label: 'Outras receitas · Outros', value: 'c5' },
    ])
  })
})

describe('nome / cor / tipo', () => {
  it('devolvem os dados da categoria existente', async () => {
    const store = await loadedStore()

    expect(store.name('c3')).toBe('Salário')
    expect(store.color('c3')).toBe('#10b981')
    expect(store.type('c3')).toBe('RENDA')
  })

  it.each([null, undefined, '', 'inexistente'])('usam o fallback para id %j', async (id) => {
    const store = await loadedStore()

    expect(store.name(id)).toBe('Sem categoria')
    expect(store.color(id)).toBe('#94a3b8')
    expect(store.type(id)).toBeNull()
  })

  it('usam o fallback antes de carregar', () => {
    const store = useCategoryStore()

    expect(store.name('c1')).toBe('Sem categoria')
    expect(store.color('c1')).toBe('#94a3b8')
    expect(store.type('c1')).toBeNull()
  })

  it('byId indexa todas as categorias', async () => {
    const store = await loadedStore()

    expect(store.byId.size).toBe(CATEGORIES.length)
    expect(store.byId.get('c2')?.name).toBe('Investimento')
  })
})
