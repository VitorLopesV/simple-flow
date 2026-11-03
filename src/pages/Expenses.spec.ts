import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Expenses from '@/pages/Expenses.vue'
import { expenseService } from '@/services/expenseService'
import type { Expense, ExpenseSummary } from '@/types/expense'

vi.mock('@/services/expenseService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/expenseService')>()
  return {
    ...original,
    expenseService: {
      list: vi.fn(),
      summary: vi.fn(),
      updateStatusBatch: vi.fn(),
    },
  }
})

const service = vi.mocked(expenseService)

function expense(id: string, overrides: Partial<Expense> = {}): Expense {
  return {
    id,
    description: `Saída ${id}`,
    amount: 100,
    date: '2026-10-02',
    categoryId: 'cat_1',
    type: 'CONTA',
    status: 'PENDENTE',
    dueDate: '2099-01-01',
    paidAt: null,
    paymentMethod: 'PIX',
    cardId: null,
    recurring: false,
    createdAt: '2026-10-02T12:00:00.000Z',
    updatedAt: '2026-10-02T12:00:00.000Z',
    ...overrides,
  }
}

const ITEMS = [
  expense('pending1'),
  expense('pending2'),
  expense('overdue', { dueDate: '2000-01-01' }),
  expense('paid1', { status: 'PAGO', paidAt: '2026-10-03' }),
  expense('paid2', { status: 'PAGO', paidAt: '2026-10-03' }),
]

const STUBS = { MonthPicker: true, CategoryFilter: true }

let wrapper: VueWrapper | undefined

async function mountPage() {
  wrapper = mount(Expenses, { global: { stubs: STUBS } })
  await flushPromises()
  return wrapper
}

async function select(screen: VueWrapper, ...ids: string[]) {
  for (const id of ids) {
    const row = screen.findAll('tbody tr').find((item) => item.text().includes(`Saída ${id}`))
    await row!.trigger('click')
  }
}

function actions(screen: VueWrapper) {
  return {
    paid: screen.find('[data-testid="batch-paid"]').exists(),
    pending: screen.find('[data-testid="batch-pending"]').exists(),
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  service.list.mockResolvedValue({ items: ITEMS, page: 1, pageSize: 20, total: 5, totalPages: 1 })
  service.summary.mockResolvedValue({
    total: 0,
    count: 0,
    average: 0,
    paidTotal: 0,
    pendingTotal: 0,
    previousMonthTotal: 0,
    byCategory: [],
    byType: [],
  } satisfies ExpenseSummary)
  service.updateStatusBatch.mockResolvedValue(undefined)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('ações em lote por situação', () => {
  it('sem seleção não mostra a barra', async () => {
    const screen = await mountPage()

    expect(screen.find('[data-testid="batch-bar"]').exists()).toBe(false)
  })

  it('só pendentes: oferece apenas "Marcar como pago"', async () => {
    const screen = await mountPage()

    await select(screen, 'pending1', 'pending2')

    expect(actions(screen)).toEqual({ paid: true, pending: false })
  })

  it('só vencidas: oferece apenas "Marcar como pago"', async () => {
    const screen = await mountPage()

    await select(screen, 'overdue')

    expect(actions(screen)).toEqual({ paid: true, pending: false })
  })

  it('só pagas: oferece apenas "Marcar como pendente"', async () => {
    const screen = await mountPage()

    await select(screen, 'paid1', 'paid2')

    expect(actions(screen)).toEqual({ paid: false, pending: true })
  })

  it('situações misturadas: nenhuma ação de situação, só selecionar todas e limpar', async () => {
    const screen = await mountPage()

    await select(screen, 'pending1', 'paid1')

    expect(actions(screen)).toEqual({ paid: false, pending: false })
    expect(screen.find('[data-testid="batch-select-all"]').exists()).toBe(true)
    expect(screen.find('button[aria-label="Limpar seleção"]').exists()).toBe(true)
  })

  it('"Marcar como pago" envia as selecionadas ao store e limpa a seleção', async () => {
    const screen = await mountPage()
    await select(screen, 'pending1', 'overdue')

    await screen.get('[data-testid="batch-paid"]').trigger('click')
    await flushPromises()

    const [sent, status] = service.updateStatusBatch.mock.calls[0]!
    expect(sent.map((item) => item.id)).toEqual(['pending1', 'overdue'])
    expect(status).toBe('PAGO')
    expect(screen.find('[data-testid="batch-bar"]').exists()).toBe(false)
  })
})
