import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import InvoiceSpendingChart from '@/components/features/InvoiceSpendingChart.vue'
import CreditCards from '@/pages/CreditCards.vue'
import { creditCardService } from '@/services/creditCardService'
import { useCategoryStore } from '@/stores/categoryStore'
import { useCreditCardStore } from '@/stores/creditCardStore'
import type { CardTransaction, CreditCardWithInvoice } from '@/types/creditCard'
import type { ExpenseType } from '@/types/expense'

vi.mock('@/services/creditCardService', () => ({
  creditCardService: { listWithInvoices: vi.fn() },
}))

const listWithInvoices = vi.mocked(creditCardService.listWithInvoices)

function transaction(id: string, cardId: string, type: ExpenseType, amount: number): CardTransaction {
  return {
    id,
    cardId,
    invoiceId: `invoice-${cardId}`,
    description: `Compra ${id}`,
    amount,
    date: '2026-10-05',
    categoryId: 'variable',
    type,
    installment: 1,
    totalInstallments: 1,
    recurring: false,
    createdAt: '',
    updatedAt: '',
  }
}

function withInvoice(id: string, transactions: CardTransaction[] | null): CreditCardWithInvoice {
  return {
    card: {
      id,
      name: `Cartão ${id}`,
      brand: 'VISA',
      lastDigits: '1234',
      limit: 5000,
      closingDay: 5,
      dueDay: 12,
      color: '#000000',
      active: true,
      createdAt: '',
    },
    invoice: transactions && {
      id: `invoice-${id}`,
      cardId: id,
      referenceMonth: '2026-10',
      closingDate: '2026-10-05',
      dueDate: '2026-10-12',
      total: transactions.reduce((sum, item) => sum + item.amount, 0),
      status: 'ABERTA',
      paidAt: null,
      transactions,
    },
    limitUsage: 0,
  }
}

const CARDS = [
  withInvoice('A', [transaction('a1', 'A', 'LAZER', 80), transaction('a2', 'A', 'CONTA', 20)]),
  withInvoice('B', [transaction('b1', 'B', 'TRANSPORTE', 45)]),
  withInvoice('C', null),
]

const STUBS = { StatisticsChart: true, MonthPicker: true }

let wrapper: VueWrapper | undefined

async function mountComponent(cards = CARDS) {
  listWithInvoices.mockResolvedValue(cards)
  wrapper = mount(CreditCards, { global: { stubs: STUBS } })
  await flushPromises()
  return wrapper
}

const spendingChart = (screen: VueWrapper) => screen.findComponent(InvoiceSpendingChart)

beforeEach(() => {
  setActivePinia(createPinia())
  useCategoryStore().categories = [
    { id: 'variable', name: 'Despesa Variável', type: 'CONTA_VARIAVEL', movement: 'SAIDA', color: '#14b8a6' },
  ]
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.clearAllMocks()
})

describe('gráfico de gastos da fatura', () => {
  it('plota a fatura do cartão selecionado', async () => {
    const screen = await mountComponent()

    expect(spendingChart(screen).props('transactions')).toEqual(CARDS[0]?.invoice?.transactions)
    expect(spendingChart(screen).props('description')).toBe('Cartão A')
    expect(spendingChart(screen).props('loading')).toBe(false)
  })

  it('acompanha a troca de cartão', async () => {
    const screen = await mountComponent()

    useCreditCardStore().select('B')
    await flushPromises()

    expect(spendingChart(screen).props('transactions')).toEqual(CARDS[1]?.invoice?.transactions)
    expect(spendingChart(screen).props('description')).toBe('Cartão B')
  })

  it('usa a fatura inteira, sem os filtros da tabela, para a soma bater com o total', async () => {
    const screen = await mountComponent()

    useCreditCardStore().filterByType('LAZER')
    await flushPromises()

    expect(spendingChart(screen).props('transactions')).toHaveLength(2)
  })

  it('cartão sem fatura no mês: o gráfico recebe uma lista vazia (estado vazio)', async () => {
    const screen = await mountComponent()

    useCreditCardStore().select('C')
    await flushPromises()

    expect(spendingChart(screen).props('transactions')).toEqual([])
    expect(screen.text()).toContain('Sem gastos na fatura')
  })

  it('não aparece quando não há cartão cadastrado', async () => {
    const screen = await mountComponent([])

    expect(spendingChart(screen).exists()).toBe(false)
  })
})
