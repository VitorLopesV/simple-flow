import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { expenseService } from '@/services/expenseService'
import { EditedMonthsError } from '@/services/http'
import { usePeriodStore } from '@/stores/periodStore'
import { useExpenseStore } from '@/stores/expenseStore'
import type { Expense, ExpensePayload, ExpenseSummary } from '@/types/expense'

// Só o service é substituído: `compararSaidasPorVencimento` continua real.
vi.mock('@/services/expenseService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/expenseService')>()
  return {
    ...original,
    expenseService: {
      list: vi.fn(),
      summary: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
  }
})

const service = vi.mocked(expenseService)

function expense(id: string, overrides: Partial<Expense> = {}): Expense {
  return {
    id,
    description: `Saída ${id}`,
    amount: 100,
    date: '2026-08-10',
    categoryId: 'cat_1',
    type: 'CONTA',
    status: 'PENDENTE',
    dueDate: null,
    paidAt: null,
    paymentMethod: 'PIX',
    cardId: null,
    recurring: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function summary(overrides: Partial<ExpenseSummary> = {}): ExpenseSummary {
  return {
    total: 1000,
    count: 2,
    average: 500,
    paidTotal: 600,
    pendingTotal: 400,
    previousMonthTotal: 800,
    byCategory: [],
    byType: [],
    ...overrides,
  }
}

const PAYLOAD: ExpensePayload = {
  description: 'Aluguel',
  amount: 1900,
  date: '2026-08-10',
  categoryId: 'cat_1',
  type: 'CONTA',
  status: 'PENDENTE',
  paymentMethod: 'PIX',
  recurring: false,
}

const ITEMS = [expense('s1'), expense('s2')]

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
  service.create.mockResolvedValue(expense('created'))
  service.update.mockResolvedValue(expense('s1'))
  service.remove.mockResolvedValue(undefined)
})

describe('estado inicial', () => {
  it('começa vazio, na página 1 e sem filtros', () => {
    const store = useExpenseStore()

    expect(store.items).toEqual([])
    expect(store.summary).toBeNull()
    expect(store.page).toBe(1)
    expect(store.pageSize).toBe(20)
    expect(store.totalPages).toBe(1)
    expect(store.categoryId).toBeNull()
    expect(store.status).toBeNull()
    expect(store.search).toBe('')
  })
})

describe('load', () => {
  it('monta o filtro com período, categoria, status, busca, página e pageSize', async () => {
    usePeriodStore().set({ month: 3, year: 2025 })
    const store = useExpenseStore()
    store.categoryId = 'cat_9'
    store.status = 'PAGO'
    store.search = 'aluguel'
    store.page = 2

    await store.load()

    expect(service.list).toHaveBeenCalledWith({
      period: { month: 3, year: 2025 },
      categoryId: 'cat_9',
      status: 'PAGO',
      search: 'aluguel',
      page: 2,
      pageSize: 20,
    })
    expect(service.summary).toHaveBeenCalledWith({ month: 3, year: 2025 })
  })

  it('preenche itens, paginação e resumo', async () => {
    const store = useExpenseStore()

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
    const store = useExpenseStore()
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
    const store = useExpenseStore()

    const promessa = store.load()
    expect(store.loading).toBe(true)
    finish()
    await promessa

    expect(store.loading).toBe(false)
  })

  it('falha: preenche erro, zera itens e desliga o loading', async () => {
    const store = useExpenseStore()
    await store.load()
    expect(store.items).toHaveLength(2)
    service.list.mockRejectedValue(new Error('Servidor fora do ar'))

    await store.load()

    expect(store.error).toBe('Servidor fora do ar')
    expect(store.items).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('falha no resumo também é tratada, com o texto padrão', async () => {
    service.summary.mockRejectedValue('quebrou')
    const store = useExpenseStore()

    await store.load()

    expect(store.error).toBe('Não foi possível carregar as saídas.')
    expect(store.items).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('uma nova carga bem-sucedida limpa o erro', async () => {
    service.list.mockRejectedValueOnce(new Error('falhou'))
    const store = useExpenseStore()
    await store.load()

    await store.load()

    expect(store.error).toBeNull()
    expect(store.items).toEqual(ITEMS)
  })
})

describe('create', () => {
  it('sucesso: retorna true, volta à página 1 e recarrega', async () => {
    const store = useExpenseStore()
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
    const store = useExpenseStore()

    const ok = await store.create(PAYLOAD)

    expect(ok).toBe(false)
    expect(store.error).toBe('Valor inválido')
    expect(service.list).not.toHaveBeenCalled()
    expect(store.saving).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    service.create.mockRejectedValue('quebrou')
    const store = useExpenseStore()

    await store.create(PAYLOAD)

    expect(store.error).toBe('Não foi possível salvar a saída.')
  })

  it('mantém salvando verdadeiro enquanto grava', async () => {
    let finish!: () => void
    service.create.mockReturnValue(new Promise((resolve) => (finish = () => resolve(expense('created')))))
    const store = useExpenseStore()

    const promessa = store.create(PAYLOAD)
    expect(store.saving).toBe(true)
    finish()
    await promessa

    expect(store.saving).toBe(false)
  })
})

describe('update', () => {
  it('sucesso: retorna true e recarrega mantendo a página', async () => {
    const store = useExpenseStore()
    store.page = 2

    const ok = await store.update('s1', PAYLOAD)

    expect(ok).toBe(true)
    expect(service.update).toHaveBeenCalledWith('s1', PAYLOAD, {})
    expect(lastFilter().page).toBe(2)
    expect(store.saving).toBe(false)
  })

  it('falha: retorna false, preenche erro, não recarrega e desliga salvando', async () => {
    service.update.mockRejectedValue(new Error('Não encontrada'))
    const store = useExpenseStore()

    const ok = await store.update('s1', PAYLOAD)

    expect(ok).toBe(false)
    expect(store.error).toBe('Não encontrada')
    expect(service.list).not.toHaveBeenCalled()
    expect(store.saving).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    service.update.mockRejectedValue(undefined)
    const store = useExpenseStore()

    await store.update('s1', PAYLOAD)

    expect(store.error).toBe('Não foi possível atualizar a saída.')
  })
})

describe('remove', () => {
  it('sucesso: retorna true e recarrega', async () => {
    const store = useExpenseStore()
    await store.load()
    service.list.mockClear()

    const ok = await store.remove('s1')

    expect(ok).toBe(true)
    expect(service.remove).toHaveBeenCalledWith('s1', {})
    expect(service.list).toHaveBeenCalledTimes(1)
    expect(store.saving).toBe(false)
  })

  it('remover o único item de uma página > 1 recua uma página', async () => {
    const store = useExpenseStore()
    store.items = [expense('s1')]
    store.page = 3

    await store.remove('s1')

    expect(lastFilter().page).toBe(2)
    expect(store.page).toBe(2)
  })

  it('não recua na página 1, mesmo removendo o único item', async () => {
    const store = useExpenseStore()
    store.items = [expense('s1')]
    store.page = 1

    await store.remove('s1')

    expect(lastFilter().page).toBe(1)
  })

  it('não recua quando a página ainda tem outros itens', async () => {
    const store = useExpenseStore()
    store.items = [expense('s1'), expense('s2')]
    store.page = 3

    await store.remove('s1')

    expect(lastFilter().page).toBe(3)
  })

  it('falha: retorna false, preenche erro, não recarrega e desliga salvando', async () => {
    service.remove.mockRejectedValue(new Error('Sem permissão'))
    const store = useExpenseStore()
    store.items = [expense('s1')]
    store.page = 3

    const ok = await store.remove('s1')

    expect(ok).toBe(false)
    expect(store.error).toBe('Sem permissão')
    expect(service.list).not.toHaveBeenCalled()
    expect(store.saving).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    service.remove.mockRejectedValue(null)
    const store = useExpenseStore()

    await store.remove('s1')

    expect(store.error).toBe('Não foi possível excluir a saída.')
  })
})

describe('toggleStatus', () => {
  it('PAGO vira PENDENTE', async () => {
    const store = useExpenseStore()

    const ok = await store.toggleStatus(expense('s1', { status: 'PAGO', paidAt: '2026-08-10' }))

    expect(ok).toBe(true)
    const [id, payload] = service.update.mock.calls[0]!
    expect(id).toBe('s1')
    expect(payload.status).toBe('PENDENTE')
  })

  it('PENDENTE vira PAGO', async () => {
    const store = useExpenseStore()

    await store.toggleStatus(expense('s1', { status: 'PENDENTE' }))

    expect(service.update.mock.calls[0]![1].status).toBe('PAGO')
  })

  it('envia payload limpo: sem id, createdAt e updatedAt, com os demais campos', async () => {
    const store = useExpenseStore()
    const original = expense('s1', { status: 'PAGO', amount: 321, description: 'Luz', recurring: true })

    await store.toggleStatus(original)

    const payload = service.update.mock.calls[0]![1]
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('createdAt')
    expect(payload).not.toHaveProperty('updatedAt')
    expect(payload).toMatchObject({
      description: 'Luz',
      amount: 321,
      date: '2026-08-10',
      categoryId: 'cat_1',
      type: 'CONTA',
      paymentMethod: 'PIX',
      recurring: true,
    })
  })

  it('não altera o objeto original recebido', async () => {
    const store = useExpenseStore()
    const original = expense('s1', { status: 'PAGO' })

    await store.toggleStatus(original)

    expect(original.status).toBe('PAGO')
    expect(original.id).toBe('s1')
    expect(original.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('recarrega a lista e devolve false quando a atualização falha', async () => {
    const store = useExpenseStore()
    await store.toggleStatus(expense('s1'))
    expect(service.list).toHaveBeenCalledTimes(1)

    service.update.mockRejectedValue(new Error('falhou'))
    const ok = await store.toggleStatus(expense('s1'))

    expect(ok).toBe(false)
    expect(store.error).toBe('falhou')
  })
})

describe('sortedItems', () => {
  it('ordena por vencimento, sem vencimento por último e mais recente primeiro', async () => {
    service.list.mockResolvedValue({
      items: [
        expense('sem-antiga', { date: '2026-08-01' }),
        expense('tarde', { dueDate: '2026-08-25' }),
        expense('sem-recente', { date: '2026-08-20' }),
        expense('cedo', { dueDate: '2026-08-03' }),
      ],
      page: 1,
      pageSize: 20,
      total: 4,
      totalPages: 1,
    })
    const store = useExpenseStore()

    await store.load()

    expect(store.sortedItems.map((s) => s.id)).toEqual(['cedo', 'tarde', 'sem-recente', 'sem-antiga'])
  })

  it('não muta itens', async () => {
    const received = [expense('b', { dueDate: '2026-08-25' }), expense('a', { dueDate: '2026-08-03' })]
    service.list.mockResolvedValue({ items: received, page: 1, pageSize: 8, total: 2, totalPages: 1 })
    const store = useExpenseStore()
    await store.load()

    const sorted = store.sortedItems

    expect(sorted.map((s) => s.id)).toEqual(['a', 'b'])
    expect(store.items.map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('não depende da ordem em que os dados chegaram', async () => {
    const data = [
      expense('x', { dueDate: '2026-08-05' }),
      expense('y', { dueDate: '2026-08-15' }),
      expense('z', { date: '2026-08-30' }),
    ]
    const store = useExpenseStore()

    store.items = [...data]
    const firstOrder = store.sortedItems.map((s) => s.id)
    store.items = [...data].reverse()
    const secondOrder = store.sortedItems.map((s) => s.id)

    expect(firstOrder).toEqual(['x', 'y', 'z'])
    expect(secondOrder).toEqual(firstOrder)
  })
})

describe('goToPage', () => {
  it('respeita os limites mínimo e máximo e recarrega', async () => {
    const store = useExpenseStore()
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
    const store = useExpenseStore()
    store.page = 3

    store.filterByCategory('cat_7')
    await flushPromises()

    expect(store.categoryId).toBe('cat_7')
    expect(store.page).toBe(1)
    expect(lastFilter()).toMatchObject({ categoryId: 'cat_7', page: 1 })
  })

  it('filterByStatus volta à página 1 e recarrega', async () => {
    const store = useExpenseStore()
    store.page = 3

    store.filterByStatus('PAGO')
    await flushPromises()

    expect(store.status).toBe('PAGO')
    expect(store.page).toBe(1)
    expect(lastFilter()).toMatchObject({ status: 'PAGO', page: 1 })
  })

  it('filterByStatus(null) remove o filtro de status', async () => {
    const store = useExpenseStore()
    store.status = 'PENDENTE'

    store.filterByStatus(null)
    await flushPromises()

    expect(store.status).toBeNull()
    expect(lastFilter().status).toBeNull()
  })

  it('buscar volta à página 1 e recarrega', async () => {
    const store = useExpenseStore()
    store.page = 3

    store.setSearch('mercado')
    await flushPromises()

    expect(store.search).toBe('mercado')
    expect(store.page).toBe(1)
    expect(lastFilter()).toMatchObject({ search: 'mercado', page: 1 })
  })

  it('clearFilters zera categoria, status e busca, volta à página 1 e recarrega', async () => {
    const store = useExpenseStore()
    store.categoryId = 'cat_7'
    store.status = 'PAGO'
    store.search = 'mercado'
    store.page = 3

    store.clearFilters()
    await flushPromises()

    expect(store.categoryId).toBeNull()
    expect(store.status).toBeNull()
    expect(store.search).toBe('')
    expect(store.page).toBe(1)
    expect(lastFilter()).toMatchObject({ categoryId: null, status: null, search: '', page: 1 })
  })
})

describe('hasActiveFilter', () => {
  it('é falso sem categoria, status e busca', () => {
    expect(useExpenseStore().hasActiveFilter).toBe(false)
  })

  it('é verdadeiro com categoria', () => {
    const store = useExpenseStore()

    store.categoryId = 'cat_1'

    expect(store.hasActiveFilter).toBe(true)
  })

  it('é verdadeiro com status', () => {
    const store = useExpenseStore()

    store.status = 'PENDENTE'

    expect(store.hasActiveFilter).toBe(true)
  })

  it('é verdadeiro com busca preenchida', () => {
    const store = useExpenseStore()

    store.search = 'abc'

    expect(store.hasActiveFilter).toBe(true)
  })

  it('busca só com espaços não conta como filtro', () => {
    const store = useExpenseStore()

    store.search = '   '

    expect(store.hasActiveFilter).toBe(false)
  })
})

describe('isEmpty', () => {
  it('é verdadeiro sem itens e sem loading', () => {
    expect(useExpenseStore().isEmpty).toBe(true)
  })

  it('é falso com itens', async () => {
    const store = useExpenseStore()

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
    const store = useExpenseStore()

    const promessa = store.load()
    expect(store.isEmpty).toBe(false)
    finish()
    await promessa

    expect(store.isEmpty).toBe(true)
  })
})

describe('periodTotal / variacao', () => {
  it('são 0 sem resumo', () => {
    const store = useExpenseStore()

    expect(store.periodTotal).toBe(0)
    expect(store.change).toBe(0)
  })

  it('periodTotal vem do resumo', async () => {
    service.summary.mockResolvedValue(summary({ total: 1234 }))
    const store = useExpenseStore()

    await store.load()

    expect(store.periodTotal).toBe(1234)
  })

  it('variacao compara com o mês anterior', async () => {
    service.summary.mockResolvedValue(summary({ total: 150, previousMonthTotal: 100 }))
    const store = useExpenseStore()

    await store.load()

    expect(store.change).toBe(0.5)
  })

  it('variacao com mês anterior zerado vira 1 se houve saída e 0 se não houve', async () => {
    const store = useExpenseStore()

    service.summary.mockResolvedValue(summary({ total: 150, previousMonthTotal: 0 }))
    await store.load()
    expect(store.change).toBe(1)

    service.summary.mockResolvedValue(summary({ total: 0, previousMonthTotal: 0 }))
    await store.load()
    expect(store.change).toBe(0)
  })
})

describe('meses seguintes alterados', () => {
  it('remove barrado guarda os meses, não marca erro e não recarrega', async () => {
    service.remove.mockRejectedValue(new EditedMonthsError(['2026-10']))
    const store = useExpenseStore()
    service.list.mockClear()

    const ok = await store.remove('s1')

    expect(ok).toBe(false)
    expect(store.editedMonths).toEqual(['2026-10'])
    expect(store.error).toBeNull()
    expect(service.list).not.toHaveBeenCalled()
    expect(store.saving).toBe(false)
  })

  it('remove com confirmação repassa a opção e limpa os meses pendentes', async () => {
    const store = useExpenseStore()
    store.editedMonths = ['2026-10']

    const ok = await store.remove('s1', { confirm: true })

    expect(ok).toBe(true)
    expect(service.remove).toHaveBeenCalledWith('s1', { confirm: true })
    expect(store.editedMonths).toBeNull()
  })

  it('update barrado (desligar recorrência) guarda os meses sem marcar erro', async () => {
    service.update.mockRejectedValue(new EditedMonthsError(['2026-10', '2026-11']))
    const store = useExpenseStore()

    const ok = await store.update('s1', PAYLOAD)

    expect(ok).toBe(false)
    expect(store.editedMonths).toEqual(['2026-10', '2026-11'])
    expect(store.error).toBeNull()
  })

  it('update com confirmação repassa a opção ao service', async () => {
    const store = useExpenseStore()

    await store.update('s1', PAYLOAD, { confirm: true })

    expect(service.update).toHaveBeenCalledWith('s1', PAYLOAD, { confirm: true })
  })
})
