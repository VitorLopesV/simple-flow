import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { incomeService } from '@/services/incomeService'
import { useIncomeStore } from '@/stores/incomeStore'
import { usePeriodStore } from '@/stores/periodStore'
import type { Income, IncomePayload, IncomeSummary } from '@/types/income'

vi.mock('@/services/incomeService', () => ({
  incomeService: {
    list: vi.fn(),
    summary: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const service = vi.mocked(incomeService)

function income(id: string): Income {
  return {
    id,
    description: `Entrada ${id}`,
    amount: 100,
    date: '2026-08-05',
    categoryId: 'cat_1',
    recurring: false,
    createdAt: '',
    updatedAt: '',
  }
}

function summary(overrides: Partial<IncomeSummary> = {}): IncomeSummary {
  return { total: 1000, count: 2, average: 500, previousMonthTotal: 800, byCategory: [], ...overrides }
}

const PAYLOAD: IncomePayload = {
  description: 'Salário',
  amount: 5000,
  date: '2026-08-05',
  categoryId: 'cat_1',
  recurring: false,
}

const ITEMS = [income('e1'), income('e2')]

/** Última chamada de `listar`, para conferir o filtro montado pelo store. */
function lastFilter() {
  return service.list.mock.calls.at(-1)![0]
}

beforeEach(() => {
  setActivePinia(createPinia())
  usePeriodStore().set({ month: 8, year: 2026 })

  vi.resetAllMocks()
  service.list.mockImplementation(async (filter) => ({
    items: ITEMS,
    page: filter.page,
    pageSize: filter.pageSize,
    total: 20,
    totalPages: 3,
  }))
  service.summary.mockResolvedValue(summary())
  service.create.mockResolvedValue(income('created'))
  service.update.mockResolvedValue(income('e1'))
  service.remove.mockResolvedValue(undefined)
})

describe('estado inicial', () => {
  it('começa vazio e na página 1', () => {
    const store = useIncomeStore()

    expect(store.items).toEqual([])
    expect(store.summary).toBeNull()
    expect(store.page).toBe(1)
    expect(store.pageSize).toBe(20)
    expect(store.totalPages).toBe(1)
    expect(store.categoryId).toBeNull()
    expect(store.search).toBe('')
  })
})

describe('load', () => {
  it('monta o filtro com período, categoria, busca, página e pageSize', async () => {
    usePeriodStore().set({ month: 3, year: 2025 })
    const store = useIncomeStore()
    store.categoryId = 'cat_9'
    store.search = 'salário'
    store.page = 2

    await store.load()

    expect(service.list).toHaveBeenCalledWith({
      period: { month: 3, year: 2025 },
      categoryId: 'cat_9',
      search: 'salário',
      page: 2,
      pageSize: 20,
    })
    expect(service.summary).toHaveBeenCalledWith({ month: 3, year: 2025 })
  })

  it('preenche itens, paginação e resumo', async () => {
    const store = useIncomeStore()

    await store.load()

    expect(store.items).toEqual(ITEMS)
    expect(store.total).toBe(20)
    expect(store.totalPages).toBe(3)
    expect(store.page).toBe(1)
    expect(store.summary).toEqual(summary())
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('adota a página normalizada devolvida pelo service', async () => {
    service.list.mockResolvedValue({ items: ITEMS, page: 3, pageSize: 8, total: 20, totalPages: 3 })
    const store = useIncomeStore()
    store.page = 99

    await store.load()

    expect(store.page).toBe(3)
  })

  it('mantém loading verdadeiro durante a chamada', async () => {
    let finish!: () => void
    service.list.mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ items: ITEMS, page: 1, pageSize: 8, total: 2, totalPages: 1 })
      }),
    )
    const store = useIncomeStore()

    const promessa = store.load()
    expect(store.loading).toBe(true)
    finish()
    await promessa

    expect(store.loading).toBe(false)
  })

  it('falha: preenche erro, zera itens e desliga o loading', async () => {
    const store = useIncomeStore()
    await store.load()
    expect(store.items).toHaveLength(2)
    service.list.mockRejectedValue(new Error('Servidor fora do ar'))

    await store.load()

    expect(store.error).toBe('Servidor fora do ar')
    expect(store.items).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('falha no resumo também é tratada', async () => {
    service.summary.mockRejectedValue('quebrou')
    const store = useIncomeStore()

    await store.load()

    expect(store.error).toBe('Não foi possível carregar as entradas.')
    expect(store.items).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('uma nova carga bem-sucedida limpa o erro', async () => {
    service.list.mockRejectedValueOnce(new Error('falhou'))
    const store = useIncomeStore()
    await store.load()

    await store.load()

    expect(store.error).toBeNull()
    expect(store.items).toEqual(ITEMS)
  })
})

describe('create', () => {
  it('sucesso: retorna true, volta à página 1 e recarrega', async () => {
    const store = useIncomeStore()
    store.page = 3

    const ok = await store.create(PAYLOAD)

    expect(ok).toBe(true)
    expect(service.create).toHaveBeenCalledWith(PAYLOAD)
    expect(lastFilter().page).toBe(1)
    expect(store.page).toBe(1)
    expect(store.items).toEqual(ITEMS)
    expect(store.saving).toBe(false)
  })

  it('falha: retorna false, preenche erro, não recarrega e desliga salvando', async () => {
    service.create.mockRejectedValue(new Error('Valor inválido'))
    const store = useIncomeStore()

    const ok = await store.create(PAYLOAD)

    expect(ok).toBe(false)
    expect(store.error).toBe('Valor inválido')
    expect(service.list).not.toHaveBeenCalled()
    expect(store.saving).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    service.create.mockRejectedValue('quebrou')
    const store = useIncomeStore()

    await store.create(PAYLOAD)

    expect(store.error).toBe('Não foi possível salvar a entrada.')
  })

  it('mantém salvando verdadeiro enquanto grava', async () => {
    let finish!: () => void
    service.create.mockReturnValue(new Promise((resolve) => (finish = () => resolve(income('created')))))
    const store = useIncomeStore()

    const promessa = store.create(PAYLOAD)
    expect(store.saving).toBe(true)
    finish()
    await promessa

    expect(store.saving).toBe(false)
  })
})

describe('update', () => {
  it('sucesso: retorna true e recarrega mantendo a página', async () => {
    const store = useIncomeStore()
    store.page = 2

    const ok = await store.update('e1', PAYLOAD)

    expect(ok).toBe(true)
    expect(service.update).toHaveBeenCalledWith('e1', PAYLOAD)
    expect(lastFilter().page).toBe(2)
    expect(store.saving).toBe(false)
  })

  it('falha: retorna false, preenche erro, não recarrega e desliga salvando', async () => {
    service.update.mockRejectedValue(new Error('Não encontrada'))
    const store = useIncomeStore()

    const ok = await store.update('e1', PAYLOAD)

    expect(ok).toBe(false)
    expect(store.error).toBe('Não encontrada')
    expect(service.list).not.toHaveBeenCalled()
    expect(store.saving).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    service.update.mockRejectedValue(undefined)
    const store = useIncomeStore()

    await store.update('e1', PAYLOAD)

    expect(store.error).toBe('Não foi possível atualizar a entrada.')
  })
})

describe('remove', () => {
  it('sucesso: retorna true e recarrega', async () => {
    const store = useIncomeStore()
    await store.load()
    service.list.mockClear()

    const ok = await store.remove('e1')

    expect(ok).toBe(true)
    expect(service.remove).toHaveBeenCalledWith('e1')
    expect(service.list).toHaveBeenCalledTimes(1)
    expect(store.saving).toBe(false)
  })

  it('remover o único item de uma página > 1 recua uma página', async () => {
    const store = useIncomeStore()
    store.items = [income('e1')]
    store.page = 3

    await store.remove('e1')

    expect(lastFilter().page).toBe(2)
    expect(store.page).toBe(2)
  })

  it('não recua na página 1, mesmo removendo o único item', async () => {
    const store = useIncomeStore()
    store.items = [income('e1')]
    store.page = 1

    await store.remove('e1')

    expect(lastFilter().page).toBe(1)
  })

  it('não recua quando a página ainda tem outros itens', async () => {
    const store = useIncomeStore()
    store.items = [income('e1'), income('e2')]
    store.page = 3

    await store.remove('e1')

    expect(lastFilter().page).toBe(3)
  })

  it('falha: retorna false, preenche erro, não recarrega e desliga salvando', async () => {
    service.remove.mockRejectedValue(new Error('Sem permissão'))
    const store = useIncomeStore()
    store.items = [income('e1')]
    store.page = 3

    const ok = await store.remove('e1')

    expect(ok).toBe(false)
    expect(store.error).toBe('Sem permissão')
    expect(service.list).not.toHaveBeenCalled()
    expect(store.saving).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    service.remove.mockRejectedValue(null)
    const store = useIncomeStore()

    await store.remove('e1')

    expect(store.error).toBe('Não foi possível excluir a entrada.')
  })
})

describe('goToPage', () => {
  it('respeita os limites mínimo e máximo e recarrega', async () => {
    const store = useIncomeStore()
    await store.load()
    expect(store.totalPages).toBe(3)
    service.list.mockClear()

    store.goToPage(0)
    await flushPromises()
    expect(lastFilter().page).toBe(1)

    store.goToPage(99)
    await flushPromises()
    expect(lastFilter().page).toBe(3)
    expect(store.page).toBe(3)

    store.goToPage(2)
    await flushPromises()
    expect(lastFilter().page).toBe(2)
    expect(store.page).toBe(2)

    expect(service.list).toHaveBeenCalledTimes(3)
  })
})

describe('filtros', () => {
  it('filterByCategory volta à página 1 e recarrega', async () => {
    const store = useIncomeStore()
    store.page = 3

    store.filterByCategory('cat_7')
    await flushPromises()

    expect(store.categoryId).toBe('cat_7')
    expect(store.page).toBe(1)
    expect(lastFilter()).toMatchObject({ categoryId: 'cat_7', page: 1 })
  })

  it('buscar volta à página 1 e recarrega', async () => {
    const store = useIncomeStore()
    store.page = 3

    store.setSearch('mercado')
    await flushPromises()

    expect(store.search).toBe('mercado')
    expect(store.page).toBe(1)
    expect(lastFilter()).toMatchObject({ search: 'mercado', page: 1 })
  })

  it('clearFilters zera categoria e busca, volta à página 1 e recarrega', async () => {
    const store = useIncomeStore()
    store.categoryId = 'cat_7'
    store.search = 'mercado'
    store.page = 3

    store.clearFilters()
    await flushPromises()

    expect(store.categoryId).toBeNull()
    expect(store.search).toBe('')
    expect(store.page).toBe(1)
    expect(lastFilter()).toMatchObject({ categoryId: null, search: '', page: 1 })
  })
})

describe('hasActiveFilter', () => {
  it('é falso sem categoria e sem busca', () => {
    expect(useIncomeStore().hasActiveFilter).toBe(false)
  })

  it('é verdadeiro com categoria', () => {
    const store = useIncomeStore()

    store.categoryId = 'cat_1'

    expect(store.hasActiveFilter).toBe(true)
  })

  it('é verdadeiro com busca preenchida', () => {
    const store = useIncomeStore()

    store.search = 'abc'

    expect(store.hasActiveFilter).toBe(true)
  })

  it('busca só com espaços não conta como filtro', () => {
    const store = useIncomeStore()

    store.search = '   '

    expect(store.hasActiveFilter).toBe(false)
  })
})

describe('isEmpty', () => {
  it('é verdadeiro sem itens e sem loading', () => {
    expect(useIncomeStore().isEmpty).toBe(true)
  })

  it('é falso com itens', async () => {
    const store = useIncomeStore()

    await store.load()

    expect(store.isEmpty).toBe(false)
  })

  it('é falso enquanto carrega, mesmo sem itens', async () => {
    let finish!: () => void
    service.list.mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ items: [], page: 1, pageSize: 8, total: 0, totalPages: 1 })
      }),
    )
    const store = useIncomeStore()

    const promessa = store.load()
    expect(store.isEmpty).toBe(false)
    finish()
    await promessa

    expect(store.isEmpty).toBe(true)
  })
})

describe('periodTotal / variacao', () => {
  it('são 0 sem resumo', () => {
    const store = useIncomeStore()

    expect(store.periodTotal).toBe(0)
    expect(store.change).toBe(0)
  })

  it('periodTotal vem do resumo', async () => {
    service.summary.mockResolvedValue(summary({ total: 1234 }))
    const store = useIncomeStore()

    await store.load()

    expect(store.periodTotal).toBe(1234)
  })

  it('variacao compara com o mês anterior', async () => {
    service.summary.mockResolvedValue(summary({ total: 150, previousMonthTotal: 100 }))
    const store = useIncomeStore()

    await store.load()

    expect(store.change).toBe(0.5)
  })

  it('variacao com mês anterior zerado vira 1 se houve entrada e 0 se não houve', async () => {
    const store = useIncomeStore()

    service.summary.mockResolvedValue(summary({ total: 150, previousMonthTotal: 0 }))
    await store.load()
    expect(store.change).toBe(1)

    service.summary.mockResolvedValue(summary({ total: 0, previousMonthTotal: 0 }))
    await store.load()
    expect(store.change).toBe(0)
  })
})
