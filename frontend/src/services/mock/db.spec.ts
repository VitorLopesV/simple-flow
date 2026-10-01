import { beforeEach, describe, expect, it } from 'vitest'

import {
  cards,
  categories,
  invoices,
  ensureInvoice,
  ensureNextCardTransaction,
  ensureNextExpense,
  ensureNextIncome,
  generateNextMonth,
  incomes,
  isFixedCategoryId,
  laterInSeries,
  recalculateInvoiceTotal,
  removeRecords,
  sameDayNextMonth,
  expenses,
  expensesWithInvoices,
  cardTransactions,
} from '@/services/mock/db'
import type { CardTransaction } from '@/types/creditCard'
import type { Expense } from '@/types/expense'
import type { Income } from '@/types/income'

function categoryId(name: string): string {
  return categories.find((category) => category.name === name)!.id
}

function transaction(invoiceId: string, amount: number, id: string): CardTransaction {
  return {
    id,
    cardId: cards[0]!.id,
    invoiceId,
    description: 'Compra',
    amount,
    date: '2026-08-10',
    categoryId: 'cat_1',
    type: 'OUTROS',
    installment: 1,
    totalInstallments: 1,
    recurring: false,
    notes: null,
    createdAt: '',
    updatedAt: '',
  }
}

function fixedExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'sai_1',
    description: 'Aluguel',
    amount: 1900,
    date: '2026-01-15',
    categoryId: categoryId('Despesa Fixa'),
    type: 'CONTA',
    status: 'PAGO',
    dueDate: '2026-01-10',
    paidAt: '2026-01-10',
    paymentMethod: 'PIX',
    cardId: null,
    recurring: true,
    seriesId: 'ser_1',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function fixedIncome(overrides: Partial<Income> = {}): Income {
  return {
    id: 'ent_1',
    description: 'Salário',
    amount: 7000,
    date: '2026-01-05',
    categoryId: categoryId('Renda Fixa'),
    type: 'SALARIO',
    recurring: true,
    seriesId: 'ser_ent',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

beforeEach(() => {
  incomes.length = 0
  expenses.length = 0
  invoices.length = 0
  cardTransactions.length = 0
})

describe('isFixedCategoryId', () => {
  it('só Despesa Fixa e Renda Fixa aceitam recorrência', () => {
    expect(isFixedCategoryId(categoryId('Despesa Fixa'))).toBe(true)
    expect(isFixedCategoryId(categoryId('Renda Fixa'))).toBe(true)
    expect(isFixedCategoryId(categoryId('Despesa Variável'))).toBe(false)
    expect(isFixedCategoryId(categoryId('Investimento'))).toBe(false)
    expect(isFixedCategoryId(categoryId('Renda Variável'))).toBe(false)
    expect(isFixedCategoryId(null)).toBe(false)
  })
})

describe('sameDayNextMonth', () => {
  it.each([
    ['2026-01-15', '2026-02-15'],
    ['2026-01-31', '2026-02-28'],
    ['2026-03-31', '2026-04-30'],
    ['2026-12-10', '2027-01-10'],
  ])('%s → %s', (from, to) => {
    expect(sameDayNextMonth(from)).toBe(to)
  })
})

describe('laterInSeries', () => {
  it('devolve só os meses posteriores da mesma série', () => {
    const jan = fixedExpense({ id: 'jan', date: '2026-01-15' })
    const feb = fixedExpense({ id: 'feb', date: '2026-02-15' })
    const mar = fixedExpense({ id: 'mar', date: '2026-03-15' })
    const other = fixedExpense({ id: 'other', date: '2026-03-15', seriesId: 'ser_2' })

    expect(laterInSeries([jan, feb, mar, other], feb).map((item) => item.id)).toEqual(['mar'])
    expect(laterInSeries([jan, feb, mar, other], jan).map((item) => item.id)).toEqual(['feb', 'mar'])
  })

  it('registro fora de série não tem meses seguintes', () => {
    const item = fixedExpense({ seriesId: null })

    expect(laterInSeries([item, fixedExpense({ id: 'x', date: '2026-02-15' })], item)).toEqual([])
  })
})

describe('removeRecords', () => {
  it('remove pelos ids, mantendo a mesma referência de array', () => {
    const list = [fixedExpense({ id: 'a' }), fixedExpense({ id: 'b' }), fixedExpense({ id: 'c' })]
    const reference = list

    removeRecords(list, [list[0]!, list[2]!])

    expect(reference.map((item) => item.id)).toEqual(['b'])
  })
})

describe('ensureNextExpense', () => {
  it('cria o mês seguinte como registro próprio, PENDENTE e com a mesma série', () => {
    const jan = fixedExpense()
    expenses.push(jan)

    ensureNextExpense(jan)

    expect(expenses).toHaveLength(2)
    expect(expenses[1]).toMatchObject({
      date: '2026-02-15',
      dueDate: '2026-02-10',
      status: 'PENDENTE',
      paidAt: null,
      seriesId: 'ser_1',
      description: 'Aluguel',
      amount: 1900,
    })
    expect(expenses[1]!.id).not.toBe(jan.id)
    expect(expenses[1]!.id).not.toContain('_2026-')
  })

  it('dia 31 vai para o último dia do mês seguinte', () => {
    const jan = fixedExpense({ date: '2026-01-31', dueDate: '2026-01-31' })
    expenses.push(jan)

    ensureNextExpense(jan)

    expect(expenses[1]).toMatchObject({ date: '2026-02-28', dueDate: '2026-02-28' })
  })

  it('não duplica quando a série já tem o mês seguinte', () => {
    const jan = fixedExpense()
    expenses.push(jan)

    ensureNextExpense(jan)
    ensureNextExpense(jan)

    expect(expenses).toHaveLength(2)
  })

  it('não faz nada para registro não recorrente ou sem série', () => {
    const notRecurring = fixedExpense({ recurring: false })
    const withoutSeries = fixedExpense({ id: 'x', seriesId: null })
    expenses.push(notRecurring, withoutSeries)

    ensureNextExpense(notRecurring)
    ensureNextExpense(withoutSeries)

    expect(expenses).toHaveLength(2)
  })

  it('o mês seguinte é independente: mudar um não altera o outro', () => {
    const jan = fixedExpense()
    expenses.push(jan)
    ensureNextExpense(jan)

    expenses[1]!.amount = 2000

    expect(expenses[0]!.amount).toBe(1900)
  })
})

describe('ensureNextIncome', () => {
  it('cria o mês seguinte da entrada recorrente', () => {
    const jan = fixedIncome()
    incomes.push(jan)

    ensureNextIncome(jan)

    expect(incomes).toHaveLength(2)
    expect(incomes[1]).toMatchObject({ date: '2026-02-05', seriesId: 'ser_ent', amount: 7000 })
  })
})

describe('ensureNextCardTransaction', () => {
  it('lança o mês seguinte na fatura daquele mês, criando-a se preciso', () => {
    const card = cards[0]!
    const august = ensureInvoice(card.id, '2026-08')
    const current: CardTransaction = {
      ...transaction(august.id, 55, 'trc_1'),
      categoryId: categoryId('Despesa Fixa'),
      recurring: true,
      seriesId: 'ser_card',
    }
    cardTransactions.push(current)

    ensureNextCardTransaction(current)

    const september = invoices.find((invoice) => invoice.cardId === card.id && invoice.referenceMonth === '2026-09')
    expect(september).toBeDefined()
    expect(cardTransactions[1]).toMatchObject({
      invoiceId: september!.id,
      date: '2026-09-10',
      seriesId: 'ser_card',
    })
    expect(september!.total).toBe(55)
  })
})

describe('generateNextMonth', () => {
  it('copia para o mês seguinte os recorrentes do mês de referência e é idempotente', () => {
    expenses.push(fixedExpense({ date: '2026-08-15', dueDate: null }))
    incomes.push(fixedIncome({ date: '2026-08-05' }))

    generateNextMonth({ month: 8, year: 2026 })
    generateNextMonth({ month: 8, year: 2026 })

    expect(expenses.map((item) => item.date)).toEqual(['2026-08-15', '2026-09-15'])
    expect(incomes.map((item) => item.date)).toEqual(['2026-08-05', '2026-09-05'])
  })

  it('ignora registros de outros meses', () => {
    expenses.push(fixedExpense({ date: '2026-06-15' }))

    generateNextMonth({ month: 8, year: 2026 })

    expect(expenses).toHaveLength(1)
  })
})

describe('ensureInvoice', () => {
  it('cria fatura ABERTA com fechamento e vencimento do cartão', () => {
    const card = cards[0]!
    const invoice = ensureInvoice(card.id, '2026-08')

    expect(invoice).toMatchObject({
      cardId: card.id,
      referenceMonth: '2026-08',
      closingDate: '2026-08-20',
      dueDate: '2026-08-27',
      total: 0,
      status: 'ABERTA',
      paidAt: null,
    })
    expect(invoices).toContain(invoice)
  })

  it('reutiliza a fatura existente da competência', () => {
    const cardId = cards[0]!.id
    const first = ensureInvoice(cardId, '2026-08')
    const second = ensureInvoice(cardId, '2026-08')

    expect(second).toBe(first)
    expect(invoices).toHaveLength(1)
  })

  it('cria faturas distintas para competências e cartões distintos', () => {
    ensureInvoice(cards[0]!.id, '2026-08')
    ensureInvoice(cards[0]!.id, '2026-09')
    ensureInvoice(cards[1]!.id, '2026-08')

    expect(invoices).toHaveLength(3)
  })

  it('lança erro para cartão inexistente', () => {
    expect(() => ensureInvoice('car_inexistente', '2026-08')).toThrow('Cartão não encontrado.')
  })
})

describe('recalculateInvoiceTotal', () => {
  it('soma apenas as transações da fatura', () => {
    const invoice = ensureInvoice(cards[0]!.id, '2026-08')
    const other = ensureInvoice(cards[0]!.id, '2026-09')
    cardTransactions.push(
      transaction(invoice.id, 100, 'trc_1'),
      transaction(invoice.id, 50.5, 'trc_2'),
      transaction(other.id, 999, 'trc_3'),
    )

    recalculateInvoiceTotal(invoice.id)

    expect(invoice.total).toBe(150.5)
    expect(other.total).toBe(0)
  })

  it('zera a fatura sem transações', () => {
    const invoice = ensureInvoice(cards[0]!.id, '2026-08')
    invoice.total = 500

    recalculateInvoiceTotal(invoice.id)

    expect(invoice.total).toBe(0)
  })

  it('não lança para id inexistente', () => {
    expect(() => recalculateInvoiceTotal('fat_inexistente')).not.toThrow()
  })
})

describe('expensesWithInvoices', () => {
  it('transforma fatura com total em saída automática pendente no cartão', () => {
    const card = cards[0]!
    const invoice = ensureInvoice(card.id, '2026-08')
    invoice.total = 320

    const derived = expensesWithInvoices().find((s) => s.id === `sai_fat_${invoice.id}`)!

    expect(derived).toMatchObject({
      description: `Fatura – ${card.name}`,
      amount: 320,
      date: invoice.dueDate,
      dueDate: invoice.dueDate,
      status: 'PENDENTE',
      paidAt: null,
      paymentMethod: 'CARTAO_CREDITO',
      cardId: card.id,
      automatic: true,
    })
  })

  it('marca como PAGO quando a fatura está paga', () => {
    const invoice = ensureInvoice(cards[0]!.id, '2026-08')
    invoice.total = 320
    invoice.status = 'PAGA'
    invoice.paidAt = '2026-08-27'

    const derived = expensesWithInvoices().find((s) => s.automatic)!

    expect(derived.status).toBe('PAGO')
    expect(derived.paidAt).toBe('2026-08-27')
  })

  it('mantém fatura atrasada como pendente', () => {
    const invoice = ensureInvoice(cards[0]!.id, '2026-08')
    invoice.total = 320
    invoice.status = 'ATRASADA'

    expect(expensesWithInvoices().find((s) => s.automatic)!.status).toBe('PENDENTE')
  })

  it('omite fatura com total zero', () => {
    ensureInvoice(cards[0]!.id, '2026-08')

    expect(expensesWithInvoices()).toEqual([])
  })

  it('inclui as saídas reais antes das derivadas', () => {
    const real = { id: 'sai_real' } as Expense
    expenses.push(real)
    const invoice = ensureInvoice(cards[0]!.id, '2026-08')
    invoice.total = 10

    const result = expensesWithInvoices()

    expect(result).toHaveLength(2)
    expect(result[0]).toBe(real)
    expect(result[1]!.automatic).toBe(true)
  })
})
