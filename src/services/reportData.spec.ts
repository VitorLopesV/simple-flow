import { describe, expect, it } from 'vitest'

import type { Category } from '@/types/category'
import type { CardTransaction, CreditCard, CreditCardWithInvoice } from '@/types/creditCard'
import type { Expense } from '@/types/expense'
import type { Income } from '@/types/income'

import { buildReportData, isInvoiceExpense } from './reportData'

const TODAY = '2026-05-20'

const categories: Category[] = [
  { id: 'cat_fix', name: 'Despesa Fixa', type: 'CONTA_FIXA', movement: 'SAIDA', color: '#111111' },
  { id: 'cat_var', name: 'Despesa Variável', type: 'CONTA_VARIAVEL', movement: 'SAIDA', color: '#222222' },
  { id: 'cat_inc', name: 'Renda Fixa', type: 'RENDA_FIXA', movement: 'ENTRADA', color: '#333333' },
]

function income(overrides: Partial<Income>): Income {
  return {
    id: 'inc',
    description: 'Salário',
    amount: 1000,
    date: '2026-05-05',
    categoryId: 'cat_inc',
    type: 'SALARIO',
    recurring: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 'exp',
    description: 'Aluguel',
    amount: 100,
    date: '2026-05-10',
    categoryId: 'cat_fix',
    type: 'CONTA',
    status: 'PAGO',
    paymentMethod: 'PIX',
    recurring: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function transaction(overrides: Partial<CardTransaction>): CardTransaction {
  return {
    id: 'tx',
    cardId: 'card',
    invoiceId: 'inv',
    description: 'Mercado',
    amount: 50,
    date: '2026-05-12',
    categoryId: 'cat_var',
    type: 'ALIMENTACAO',
    installment: 1,
    totalInstallments: 1,
    recurring: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

const card: CreditCard = {
  id: 'card',
  name: 'Nubank',
  brand: 'MASTERCARD',
  lastDigits: '1234',
  limit: 5000,
  closingDay: 5,
  dueDay: 12,
  color: '#8a05be',
  active: true,
  createdAt: '',
}

function cardWithInvoice(total: number, transactions: CardTransaction[]): CreditCardWithInvoice {
  return {
    card,
    limitUsage: 0,
    invoice: {
      id: 'inv',
      cardId: 'card',
      referenceMonth: '2026-05',
      closingDate: '2026-05-05',
      dueDate: '2026-05-12',
      total,
      status: 'ABERTA',
      transactions,
    },
  }
}

/** A saída derivada que a API devolve para a fatura do cartão. */
const invoiceExpense = expense({
  id: 'sai_fat_inv',
  description: 'Fatura – Nubank',
  amount: 200,
  paymentMethod: 'CARTAO_CREDITO',
  automatic: true,
  status: 'PENDENTE',
})

describe('isInvoiceExpense', () => {
  it('reconhece só a saída derivada de fatura de cartão', () => {
    expect(isInvoiceExpense(invoiceExpense)).toBe(true)
    expect(isInvoiceExpense(expense({ paymentMethod: 'CARTAO_CREDITO' }))).toBe(false)
    expect(isInvoiceExpense(expense({ automatic: true }))).toBe(false)
  })
})

describe('buildReportData', () => {
  it('não conta a fatura em dobro: saída derivada fica fora das saídas à vista', () => {
    const data = buildReportData({
      incomes: [income({ amount: 1000 })],
      expenses: [expense({ amount: 100 }), invoiceExpense],
      cards: [cardWithInvoice(200, [transaction({ amount: 200 })])],
      categories,
      today: TODAY,
    })

    expect(data.totals.cashExpenses).toBe(100)
    expect(data.totals.invoices).toBe(200)
    expect(data.expenseGroups.flatMap((group) => group.items)).toHaveLength(1)
  })

  it('calcula o saldo como entradas − saídas à vista − faturas', () => {
    const data = buildReportData({
      incomes: [income({ amount: 1000 }), income({ id: 'i2', amount: 500 })],
      expenses: [expense({ amount: 300 }), expense({ id: 'e2', amount: 100 }), invoiceExpense],
      cards: [cardWithInvoice(200, [transaction({ amount: 200 })])],
      categories,
      today: TODAY,
    })

    expect(data.totals.income).toBe(1500)
    expect(data.totals.balance).toBe(1500 - 400 - 200)
  })

  it('soma só as faturas existentes e ignora cartão sem fatura no mês', () => {
    const data = buildReportData({
      incomes: [],
      expenses: [],
      cards: [cardWithInvoice(80, []), { card, invoice: null, limitUsage: 0 }],
      categories,
      today: TODAY,
    })

    expect(data.totals.invoices).toBe(80)
    expect(data.totals.balance).toBe(-80)
  })

  it('separa as saídas à vista em pago, pendente e vencido', () => {
    const data = buildReportData({
      incomes: [],
      expenses: [
        expense({ id: 'a', amount: 100, status: 'PAGO', dueDate: '2026-05-01' }),
        expense({ id: 'b', amount: 40, status: 'PENDENTE', dueDate: '2026-05-30' }),
        expense({ id: 'c', amount: 60, status: 'PENDENTE', dueDate: null }),
        expense({ id: 'd', amount: 25, status: 'PENDENTE', dueDate: '2026-05-10' }),
        invoiceExpense,
      ],
      cards: [],
      categories,
      today: TODAY,
    })

    expect(data.status.paid).toEqual({ amount: 100, count: 1 })
    expect(data.status.pending).toEqual({ amount: 100, count: 2 })
    expect(data.status.overdue).toEqual({ amount: 25, count: 1 })
  })

  it('agrupa por categoria com subtotal, do maior para o menor, e itens por data', () => {
    const data = buildReportData({
      incomes: [],
      expenses: [
        expense({ id: 'a', amount: 30, date: '2026-05-20', categoryId: 'cat_var' }),
        expense({ id: 'b', amount: 500, date: '2026-05-15', categoryId: 'cat_fix' }),
        expense({ id: 'c', amount: 80, date: '2026-05-02', categoryId: 'cat_var' }),
      ],
      cards: [],
      categories,
      today: TODAY,
    })

    expect(data.expenseGroups.map((group) => [group.name, group.total])).toEqual([
      ['Despesa Fixa', 500],
      ['Despesa Variável', 110],
    ])
    expect(data.expenseGroups[1]!.items.map((item) => item.id)).toEqual(['c', 'a'])
  })

  it('usa "Sem categoria" quando a categoria não existe mais', () => {
    const data = buildReportData({
      incomes: [income({ categoryId: 'removida' })],
      expenses: [],
      cards: [],
      categories,
      today: TODAY,
    })

    expect(data.incomeGroups[0]!.name).toBe('Sem categoria')
  })

  it('soma à vista + cartão por categoria e por tipo, com percentuais que fecham 100', () => {
    const data = buildReportData({
      incomes: [],
      expenses: [expense({ amount: 100, type: 'CONTA', categoryId: 'cat_fix' }), invoiceExpense],
      cards: [
        cardWithInvoice(300, [
          transaction({ id: 't1', amount: 100, type: 'ALIMENTACAO', categoryId: 'cat_var' }),
          transaction({ id: 't2', amount: 200, type: 'CONTA', categoryId: 'cat_fix' }),
        ]),
      ],
      categories,
      today: TODAY,
    })

    expect(data.expenseBars.map((bar) => [bar.name, bar.total])).toEqual([
      ['Despesa Fixa', 300],
      ['Despesa Variável', 100],
    ])
    expect(data.typeSlices.map((slice) => [slice.type, slice.total])).toEqual([
      ['CONTA', 300],
      ['ALIMENTACAO', 100],
    ])
    expect(data.typeSlices.reduce((total, slice) => total + slice.percent, 0)).toBeCloseTo(100)
    expect(data.typeSlices[0]!.label).toBe('Conta')
  })

  it('devolve tudo zerado e sem grupos num mês vazio', () => {
    const data = buildReportData({ incomes: [], expenses: [], cards: [], categories, today: TODAY })

    expect(data.totals).toEqual({ income: 0, cashExpenses: 0, invoices: 0, balance: 0 })
    expect(data.incomeGroups).toEqual([])
    expect(data.expenseGroups).toEqual([])
    expect(data.typeSlices).toEqual([])
  })
})
