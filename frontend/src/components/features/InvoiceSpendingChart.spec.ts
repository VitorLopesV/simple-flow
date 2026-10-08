import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import InvoiceSpendingChart from '@/components/features/InvoiceSpendingChart.vue'
import StatisticsChart from '@/components/features/StatisticsChart.vue'
import { useCategoryStore } from '@/stores/categoryStore'
import type { CardTransaction } from '@/types/creditCard'
import type { ExpenseType } from '@/types/expense'
import { EXPENSE_TYPE_COLOR } from '@/types/expense'

let sequence = 0

function transaction(categoryId: string, type: ExpenseType, amount: number): CardTransaction {
  sequence += 1
  return {
    id: `t${sequence}`,
    cardId: 'card-1',
    invoiceId: 'invoice-1',
    description: `Débito ${sequence}`,
    amount,
    date: '2026-10-05',
    categoryId,
    type,
    installment: 1,
    totalInstallments: 1,
    recurring: false,
    createdAt: '2026-10-05T12:00:00.000Z',
    updatedAt: '2026-10-05T12:00:00.000Z',
  }
}

/** Fatura com categorias e tipos variados — total de R$ 400,30. */
const TRANSACTIONS = [
  transaction('variable', 'ALIMENTACAO', 100.1),
  transaction('variable', 'TRANSPORTE', 50.1),
  transaction('fixed', 'CONTA', 200.1),
  transaction('variable', 'ALIMENTACAO', 50),
]

let wrapper: VueWrapper | undefined

function mountComponent(props: { transactions?: CardTransaction[]; loading?: boolean; description?: string } = {}) {
  wrapper = mount(InvoiceSpendingChart, {
    props: { transactions: TRANSACTIONS, ...props },
    global: { stubs: { StatisticsChart: true } },
  })
  return wrapper
}

const chart = (screen: VueWrapper) => screen.findComponent(StatisticsChart)
const total = (data: number[]) => Math.round(data.reduce((sum, value) => sum + value, 0) * 100) / 100

function button(screen: VueWrapper, label: string) {
  const found = screen
    .get('[data-testid="invoice-spending-view"]')
    .findAll('button')
    .find((item) => item.text() === label)
  if (!found) throw new Error(`Botão "${label}" não encontrado`)
  return found
}

beforeEach(() => {
  setActivePinia(createPinia())
  useCategoryStore().categories = [
    { id: 'fixed', name: 'Despesa Fixa', type: 'CONTA_FIXA', movement: 'SAIDA', color: '#6366f1' },
    { id: 'variable', name: 'Despesa Variável', type: 'CONTA_VARIAVEL', movement: 'SAIDA', color: '#14b8a6' },
  ]
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('gráfico de gastos da fatura', () => {
  it('é um gráfico de rosca no card "Gastos da fatura", com a descrição recebida', () => {
    const screen = mountComponent({ description: 'Itaú Click' })

    expect(screen.text()).toContain('Gastos da fatura')
    expect(screen.text()).toContain('Itaú Click')
    expect(chart(screen).props('type')).toBe('doughnut')
  })

  it('começa por categoria, com nome e cor da categoria, da maior para a menor', () => {
    const screen = mountComponent()

    expect(button(screen, 'Categoria').attributes('aria-pressed')).toBe('true')
    expect(button(screen, 'Tipo').attributes('aria-pressed')).toBe('false')
    expect(chart(screen).props('labels')).toEqual(['Despesa Variável', 'Despesa Fixa'])
    expect(chart(screen).props('series')[0].data).toEqual([200.2, 200.1])
    expect(chart(screen).props('colors')).toEqual(['#14b8a6', '#6366f1'])
  })

  it('alterna para tipo no mesmo gráfico, com as cores de tipo da Dashboard', async () => {
    const screen = mountComponent()

    await button(screen, 'Tipo').trigger('click')

    expect(button(screen, 'Tipo').attributes('aria-pressed')).toBe('true')
    expect(button(screen, 'Categoria').attributes('aria-pressed')).toBe('false')
    expect(screen.findAllComponents(StatisticsChart)).toHaveLength(1)
    expect(chart(screen).props('labels')).toEqual(['Conta', 'Alimentação', 'Transporte'])
    expect(chart(screen).props('series')[0].data).toEqual([200.1, 150.1, 50.1])
    expect(chart(screen).props('colors')).toEqual([
      EXPENSE_TYPE_COLOR.CONTA,
      EXPENSE_TYPE_COLOR.ALIMENTACAO,
      EXPENSE_TYPE_COLOR.TRANSPORTE,
    ])

    await button(screen, 'Categoria').trigger('click')

    expect(chart(screen).props('labels')).toEqual(['Despesa Variável', 'Despesa Fixa'])
  })

  it('a soma das fatias bate com o total da fatura nas duas visões', async () => {
    const screen = mountComponent()

    expect(total(chart(screen).props('series')[0].data)).toBe(400.3)

    await button(screen, 'Tipo').trigger('click')

    expect(total(chart(screen).props('series')[0].data)).toBe(400.3)
  })

  it('não corta fatias: todas as categorias e tipos aparecem', async () => {
    const types: ExpenseType[] = [
      'TRANSPORTE',
      'ALIMENTACAO',
      'LAZER',
      'CONTA',
      'POUPANCA',
      'ACOES',
      'EDUCACAO',
      'COMPRAS',
    ]
    const screen = mountComponent({ transactions: types.map((type, i) => transaction('variable', type, i + 1)) })

    await button(screen, 'Tipo').trigger('click')

    expect(chart(screen).props('labels')).toHaveLength(types.length)
  })

  it('acompanha a troca de fatura (outro cartão ou mês)', async () => {
    const screen = mountComponent()

    await screen.setProps({ transactions: [transaction('fixed', 'LAZER', 30)] })

    expect(chart(screen).props('labels')).toEqual(['Despesa Fixa'])
    expect(chart(screen).props('series')[0].data).toEqual([30])
  })

  it('descreve as fatias em texto para leitor de tela', () => {
    const screen = mountComponent()

    const items = screen.findAll('ul.sr-only li').map((item) => item.text().replace(/\s/g, ' '))
    expect(items).toEqual(['Despesa Variável: R$ 200,20', 'Despesa Fixa: R$ 200,10'])
  })

  it('mostra estado vazio em vez do gráfico quando a fatura não tem gastos', () => {
    const screen = mountComponent({ transactions: [] })

    expect(screen.text()).toContain('Sem gastos na fatura')
    expect(chart(screen).exists()).toBe(false)
  })

  it('mostra skeleton durante o carregamento', () => {
    const screen = mountComponent({ loading: true })

    expect(screen.find('[role="status"]').exists()).toBe(true)
    expect(chart(screen).exists()).toBe(false)
    expect(screen.text()).not.toContain('Sem gastos na fatura')
  })
})
