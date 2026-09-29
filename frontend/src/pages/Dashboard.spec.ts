import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StatisticsChart from '@/components/features/StatisticsChart.vue'
import Dashboard from '@/pages/Dashboard.vue'
import { dashboardService } from '@/services/dashboardService'
import { expenseService } from '@/services/expenseService'
import type { DashboardSummary } from '@/types/dashboard'

vi.mock('@/services/dashboardService', () => ({
  dashboardService: { summary: vi.fn() },
}))

vi.mock('@/services/expenseService', () => ({
  expenseService: { summary: vi.fn() },
}))

const summaryMock = vi.mocked(dashboardService.summary)
const expenseSummaryMock = vi.mocked(expenseService.summary)

const POINTS = ['mar/26', 'abr/26', 'mai/26', 'jun/26', 'jul/26', 'ago/26']

function points(values: number[]) {
  return POINTS.map((label, index) => ({ label, value: values[index] ?? 0 }))
}

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    totalIncome: 1000,
    totalExpenses: 350,
    balance: 650,
    totalInvoices: 0,
    incomeChange: 0,
    expenseChange: 0,
    incomeSeries: points([0, 0, 0, 0, 0, 1000]),
    expenseSeries: points([0, 0, 0, 0, 0, 350]),
    expensesByCategory: [],
    incomeByCategory: [],
    recentTransactions: [],
    ...overrides,
  }
}

const STUBS = { StatisticsChart: true, MonthPicker: true }

let wrapper: VueWrapper | undefined

async function mountComponent(data: DashboardSummary) {
  summaryMock.mockResolvedValue(data)
  wrapper = mount(Dashboard, { global: { stubs: STUBS } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  expenseSummaryMock.mockResolvedValue({
    total: 0,
    count: 0,
    average: 0,
    paidTotal: 0,
    pendingTotal: 0,
    previousMonthTotal: 0,
    byCategory: [],
    byType: [],
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.clearAllMocks()
})

describe('saldo do mês', () => {
  it('mostra a porcentagem já consumida das entradas', async () => {
    const screen = await mountComponent(summary())

    expect(screen.text()).toContain('35% consumido')
  })

  it('limita em 100% quando as saídas superam as entradas', async () => {
    const screen = await mountComponent(summary({ totalExpenses: 2500, balance: -1500 }))

    expect(screen.text()).toContain('100% consumido')
  })

  it('mostra 0% sem saídas', async () => {
    const screen = await mountComponent(summary({ totalExpenses: 0, balance: 1000 }))

    expect(screen.text()).toContain('0% consumido')
  })

  it('explica o caso sem entradas', async () => {
    const screen = await mountComponent(summary({ totalIncome: 0, totalExpenses: 300, balance: -300 }))

    expect(screen.text()).toContain('sem entradas no mês')
  })

  it('informa quando não há movimentação', async () => {
    const screen = await mountComponent(summary({ totalIncome: 0, totalExpenses: 0, balance: 0 }))

    expect(screen.text()).toContain('sem movimentações no mês')
  })

  it('não exibe mais o card "Comprometimento da renda"', async () => {
    const screen = await mountComponent(summary())

    expect(screen.text()).not.toContain('Comprometimento da renda')
  })
})

describe('gráfico de barras', () => {
  function barSeries(screen: VueWrapper) {
    const bar = screen
      .findAllComponents(StatisticsChart)
      .find((chart) => chart.props('type') === 'bar')

    return bar?.props('series')
  }

  it('separa entradas, saídas sem cartão e cartões', async () => {
    const screen = await mountComponent(
      summary({
        incomeSeries: points([0, 0, 0, 0, 600, 1500]),
        expenseSeries: points([0, 0, 0, 50, 400, 1200]),
        invoiceSeries: points([0, 0, 0, 0, 100, 450]),
      }),
    )

    const series = barSeries(screen)

    expect(series?.map((series: { name: string }) => series.name)).toEqual(['Entradas', 'Saídas', 'Cartões'])
    expect(series?.[0].data).toEqual([0, 0, 0, 0, 600, 1500])
    // A fatura já está somada nas saídas: é subtraída para não aparecer duas vezes.
    expect(series?.[1].data).toEqual([0, 0, 0, 50, 300, 750])
    expect(series?.[2].data).toEqual([0, 0, 0, 0, 100, 450])
  })

  it('trata backend sem invoiceSeries como sem cartão', async () => {
    const screen = await mountComponent(summary({ expenseSeries: points([0, 0, 0, 0, 0, 350]) }))

    const series = barSeries(screen)

    expect(series?.[1].data).toEqual([0, 0, 0, 0, 0, 350])
    expect(series?.[2].data).toEqual([0, 0, 0, 0, 0, 0])
  })
})

describe('gráficos', () => {
  it('mostra o gráfico de linha de acompanhamento junto dos demais', async () => {
    expenseSummaryMock.mockResolvedValue({
      total: 100,
      count: 1,
      average: 100,
      paidTotal: 0,
      pendingTotal: 100,
      previousMonthTotal: 0,
      byCategory: [],
      byType: [{ type: 'CONTA', total: 100 }],
    })
    const category = [{ name: 'Casa', color: '#6366f1', total: 100 }]
    const screen = await mountComponent(summary({ expensesByCategory: category, incomeByCategory: category }))

    const types = screen.findAllComponents(StatisticsChart).map((chart) => chart.props('type'))

    expect(types).toEqual(['bar', 'line', 'doughnut', 'doughnut', 'doughnut'])
  })
})

/** Seletor Saídas/Cartões de um card (`type` ou `category`), pelo `data-testid`. */
function sourceToggle(screen: VueWrapper, card: 'type' | 'category') {
  return screen.get(`[data-testid="expense-source-by-${card}"]`)
}

function sourceButton(screen: VueWrapper, card: 'type' | 'category', label: string) {
  const found = sourceToggle(screen, card)
    .findAll('button')
    .find((item) => item.text() === label)
  if (!found) throw new Error(`Botão "${label}" não encontrado`)
  return found
}

/** Rótulos do gráfico que fica no mesmo card do seletor Saídas/Cartões. */
function cardLabels(screen: VueWrapper, card: 'type' | 'category'): string[] | undefined {
  const section = sourceToggle(screen, card).element.closest('section')
  return screen
    .findAllComponents(StatisticsChart)
    .find((chart) => section?.contains(chart.element))
    ?.props('labels')
}

describe('gastos por tipo', () => {
  const button = (screen: VueWrapper, label: string) => sourceButton(screen, 'type', label)
  const chartLabels = (screen: VueWrapper) => cardLabels(screen, 'type')

  beforeEach(() => {
    expenseSummaryMock.mockResolvedValue({
      total: 300,
      count: 2,
      average: 150,
      paidTotal: 0,
      pendingTotal: 300,
      previousMonthTotal: 0,
      byCategory: [],
      byType: [
        { type: 'CONTA', total: 200 },
        { type: 'TRANSPORTE', total: 100 },
      ],
    })
  })

  it('começa em Saídas, plotando os gastos das saídas por tipo', async () => {
    const screen = await mountComponent(summary({ cardExpensesByType: [{ type: 'LAZER', total: 80 }] }))

    expect(button(screen, 'Saídas').attributes('aria-pressed')).toBe('true')
    expect(button(screen, 'Cartões').attributes('aria-pressed')).toBe('false')
    expect(chartLabels(screen)).toEqual(['Conta', 'Transporte'])
  })

  it('alterna para os gastos de cartão no mesmo gráfico, com um só botão ativo', async () => {
    const screen = await mountComponent(
      summary({
        cardExpensesByType: [
          { type: 'LAZER', total: 80 },
          { type: 'ALIMENTACAO', total: 40 },
        ],
      }),
    )

    await button(screen, 'Cartões').trigger('click')

    expect(button(screen, 'Cartões').attributes('aria-pressed')).toBe('true')
    expect(button(screen, 'Saídas').attributes('aria-pressed')).toBe('false')
    expect(chartLabels(screen)).toEqual(['Lazer', 'Alimentação'])

    await button(screen, 'Saídas').trigger('click')

    expect(button(screen, 'Saídas').attributes('aria-pressed')).toBe('true')
    expect(chartLabels(screen)).toEqual(['Conta', 'Transporte'])
  })

  it('mostra estado vazio de cartão quando não há gastos no cartão (ou o backend não manda o campo)', async () => {
    const screen = await mountComponent(summary())

    await button(screen, 'Cartões').trigger('click')

    expect(screen.text()).toContain('Sem gastos no cartão')
    expect(chartLabels(screen)).toBeUndefined()
  })
})

describe('gastos por categoria', () => {
  const button = (screen: VueWrapper, label: string) => sourceButton(screen, 'category', label)
  const chartLabels = (screen: VueWrapper) => cardLabels(screen, 'category')

  const data = summary({
    expensesByCategory: [
      { name: 'Despesa Variável', color: '#14b8a6', total: 300 },
      { name: 'Despesa Fixa', color: '#6366f1', total: 50 },
    ],
    cardExpensesByCategory: [
      { name: 'Despesa Fixa', color: '#6366f1', total: 90 },
      { name: 'Investimento', color: '#0891b2', total: 20 },
    ],
  })

  it('começa em Saídas, plotando os gastos das saídas por categoria', async () => {
    const screen = await mountComponent(data)

    expect(button(screen, 'Saídas').attributes('aria-pressed')).toBe('true')
    expect(button(screen, 'Cartões').attributes('aria-pressed')).toBe('false')
    expect(chartLabels(screen)).toEqual(['Despesa Variável', 'Despesa Fixa'])
  })

  it('alterna para os gastos de cartão por categoria, com um só botão ativo', async () => {
    const screen = await mountComponent(data)

    await button(screen, 'Cartões').trigger('click')

    expect(button(screen, 'Cartões').attributes('aria-pressed')).toBe('true')
    expect(button(screen, 'Saídas').attributes('aria-pressed')).toBe('false')
    expect(chartLabels(screen)).toEqual(['Despesa Fixa', 'Investimento'])

    await button(screen, 'Saídas').trigger('click')

    expect(chartLabels(screen)).toEqual(['Despesa Variável', 'Despesa Fixa'])
  })

  it('não mexe no gráfico de gastos por tipo ao alternar', async () => {
    const screen = await mountComponent(data)

    await button(screen, 'Cartões').trigger('click')

    expect(sourceButton(screen, 'type', 'Saídas').attributes('aria-pressed')).toBe('true')
  })

  it('mostra estado vazio de cartão quando o backend não manda o campo', async () => {
    const screen = await mountComponent(summary({ expensesByCategory: data.expensesByCategory }))

    await button(screen, 'Cartões').trigger('click')

    expect(screen.text()).toContain('Sem gastos no cartão')
    expect(chartLabels(screen)).toBeUndefined()
  })
})

describe('painel de últimas transações', () => {
  function button(screen: VueWrapper) {
    return screen.get('button[aria-controls="recent-transactions-panel"]')
  }

  function panelVisible(screen: VueWrapper): boolean {
    const panel = screen.get('[data-testid="recent-transactions-panel"]')
    return panel.element.parentElement?.getAttribute('aria-hidden') === 'false'
  }

  it('começa oculto', async () => {
    const screen = await mountComponent(summary())

    expect(button(screen).attributes('aria-expanded')).toBe('false')
    expect(panelVisible(screen)).toBe(false)
  })

  it('abre e fecha ao clicar no botão', async () => {
    const screen = await mountComponent(summary())

    await button(screen).trigger('click')
    expect(button(screen).attributes('aria-expanded')).toBe('true')
    expect(panelVisible(screen)).toBe(true)

    await button(screen).trigger('click')
    expect(button(screen).attributes('aria-expanded')).toBe('false')
    expect(panelVisible(screen)).toBe(false)
  })

  it('fecha com a tecla Esc', async () => {
    const screen = await mountComponent(summary())
    await button(screen).trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await screen.vm.$nextTick()

    expect(panelVisible(screen)).toBe(false)
  })

  it('o botão tem só ícone, com nome acessível', async () => {
    const screen = await mountComponent(summary())

    expect(button(screen).text()).toBe('')
    expect(button(screen).attributes('aria-label')).toBe('Últimas transações')
  })
})
