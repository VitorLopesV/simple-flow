import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dashboardService } from '@/services/dashboardService'
import { expenseService } from '@/services/expenseService'
import { useDashboardStore } from '@/stores/dashboardStore'
import { usePeriodStore } from '@/stores/periodStore'
import type { DashboardSummary } from '@/types/dashboard'
import type { ExpenseSummary } from '@/types/expense'

vi.mock('@/services/dashboardService', () => ({
  dashboardService: { summary: vi.fn() },
}))

vi.mock('@/services/expenseService', () => ({
  expenseService: { summary: vi.fn() },
}))

const summaryMock = vi.mocked(dashboardService.summary)
const expenseSummaryMock = vi.mocked(expenseService.summary)

function expenseSummary(overrides: Partial<ExpenseSummary> = {}): ExpenseSummary {
  return {
    total: 0,
    count: 0,
    average: 0,
    paidTotal: 0,
    pendingTotal: 0,
    previousMonthTotal: 0,
    byCategory: [],
    byType: [],
    ...overrides,
  }
}

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    totalIncome: 1000,
    totalExpenses: 400,
    balance: 600,
    totalInvoices: 0,
    incomeChange: 0,
    expenseChange: 0,
    incomeSeries: [],
    expenseSeries: [],
    expensesByCategory: [],
    incomeByCategory: [],
    recentTransactions: [],
    ...overrides,
  }
}

/** Store carregado com o resumo informado. */
async function storeWith(data: Partial<DashboardSummary>) {
  summaryMock.mockResolvedValue(summary(data))
  const store = useDashboardStore()
  await store.load()
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  summaryMock.mockReset()
  summaryMock.mockResolvedValue(summary())
  expenseSummaryMock.mockReset()
  expenseSummaryMock.mockResolvedValue(expenseSummary())
})

describe('load', () => {
  it('preenche expensesByType com o byType do resumo de saídas do mesmo período', async () => {
    usePeriodStore().set({ month: 3, year: 2025 })
    expenseSummaryMock.mockResolvedValue(
      expenseSummary({ byType: [{ type: 'LAZER', total: 50 }] }),
    )
    const store = useDashboardStore()

    await store.load()

    expect(expenseSummaryMock).toHaveBeenCalledWith({ month: 3, year: 2025 })
    expect(store.expensesByType).toEqual([{ type: 'LAZER', total: 50 }])
  })

  it('trata ausência de byType (backend antigo) como lista vazia', async () => {
    expenseSummaryMock.mockResolvedValue({ ...expenseSummary(), byType: undefined } as never)
    const store = useDashboardStore()

    await store.load()

    expect(store.expensesByType).toEqual([])
  })

  it('chama o service com o período do periodoStore e preenche o resumo', async () => {
    usePeriodStore().set({ month: 3, year: 2025 })
    const expected = summary({ totalIncome: 123 })
    summaryMock.mockResolvedValue(expected)
    const store = useDashboardStore()

    await store.load()

    expect(summaryMock).toHaveBeenCalledTimes(1)
    expect(summaryMock).toHaveBeenCalledWith({ month: 3, year: 2025 })
    expect(store.summary).toEqual(expected)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('usa o período vigente a cada chamada', async () => {
    const period = usePeriodStore()
    const store = useDashboardStore()
    period.set({ month: 1, year: 2026 })
    await store.load()

    period.next()
    await store.load()

    expect(summaryMock).toHaveBeenNthCalledWith(1, { month: 1, year: 2026 })
    expect(summaryMock).toHaveBeenNthCalledWith(2, { month: 2, year: 2026 })
  })

  it('mantém loading verdadeiro enquanto a chamada está em andamento', async () => {
    let finish!: (date: DashboardSummary) => void
    summaryMock.mockReturnValue(new Promise<DashboardSummary>((resolve) => (finish = resolve)))
    const store = useDashboardStore()

    const promessa = store.load()
    expect(store.loading).toBe(true)

    finish(summary())
    await promessa

    expect(store.loading).toBe(false)
  })

  it('falha: preenche erro, zera o resumo e desliga o loading', async () => {
    const store = await storeWith({ totalIncome: 500 })
    expect(store.summary).not.toBeNull()
    summaryMock.mockRejectedValue(new Error('Servidor fora do ar'))

    await store.load()

    expect(store.error).toBe('Servidor fora do ar')
    expect(store.summary).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    summaryMock.mockRejectedValue('quebrou')
    const store = useDashboardStore()

    await store.load()

    expect(store.error).toBe('Não foi possível carregar o resumo financeiro.')
  })

  it('uma nova tentativa bem-sucedida limpa o erro', async () => {
    summaryMock.mockRejectedValueOnce(new Error('falhou'))
    const store = useDashboardStore()
    await store.load()
    expect(store.error).toBe('falhou')

    await store.load()

    expect(store.error).toBeNull()
    expect(store.summary).toEqual(summary())
  })
})

describe('isBalancePositive', () => {
  it('é verdadeiro para saldo positivo', async () => {
    expect((await storeWith({ balance: 100 })).isBalancePositive).toBe(true)
  })

  it('é verdadeiro para saldo zero', async () => {
    expect((await storeWith({ balance: 0 })).isBalancePositive).toBe(true)
  })

  it('é falso para saldo negativo', async () => {
    expect((await storeWith({ balance: -0.01 })).isBalancePositive).toBe(false)
  })

  it('é verdadeiro sem resumo', () => {
    expect(useDashboardStore().isBalancePositive).toBe(true)
  })
})

describe('incomeCommitment', () => {
  it('calcula saídas sobre entradas em percentual', async () => {
    expect((await storeWith({ totalIncome: 1000, totalExpenses: 250 })).incomeCommitment).toBe(25)
  })

  it('aceita frações', async () => {
    expect((await storeWith({ totalIncome: 3, totalExpenses: 1 })).incomeCommitment).toBeCloseTo(33.333, 2)
  })

  it('é exatamente 100 quando saídas igualam entradas', async () => {
    expect((await storeWith({ totalIncome: 1000, totalExpenses: 1000 })).incomeCommitment).toBe(100)
  })

  it('é limitado a 100 quando as saídas superam as entradas', async () => {
    expect((await storeWith({ totalIncome: 1000, totalExpenses: 2500 })).incomeCommitment).toBe(100)
  })

  it('é 100 com entradas 0 e saídas maiores que 0, sem Infinity', async () => {
    const { incomeCommitment } = await storeWith({ totalIncome: 0, totalExpenses: 300 })

    expect(incomeCommitment).toBe(100)
    expect(Number.isFinite(incomeCommitment)).toBe(true)
  })

  it('é 0 com entradas e saídas 0, sem NaN', async () => {
    const { incomeCommitment } = await storeWith({ totalIncome: 0, totalExpenses: 0 })

    expect(incomeCommitment).toBe(0)
    expect(Number.isNaN(incomeCommitment)).toBe(false)
  })

  it('é 0 sem resumo', () => {
    expect(useDashboardStore().incomeCommitment).toBe(0)
  })

  it('volta a 0 depois de uma falha que zera o resumo', async () => {
    const store = await storeWith({ totalIncome: 1000, totalExpenses: 500 })
    expect(store.incomeCommitment).toBe(50)
    summaryMock.mockRejectedValue(new Error('falhou'))

    await store.load()

    expect(store.incomeCommitment).toBe(0)
    expect(store.isBalancePositive).toBe(true)
  })
})
