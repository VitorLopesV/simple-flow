import { beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { dashboardService } from '@/services/dashboardService'
import { mockDb } from '@/services/mock'
import type { CreditCard, CardTransaction } from '@/types/creditCard'
import type { Income } from '@/types/income'
import type { Expense } from '@/types/expense'

type Db = Awaited<ReturnType<typeof mockDb>>

const AUGUST = { month: 8, year: 2026 }
const DEFAULT_COLOR = '#94a3b8'

let db: Db
let catA: { id: string; name: string; color: string }
let catB: { id: string; name: string; color: string }

let sequence = 0

function income(overrides: Partial<Income> = {}): Income {
  sequence += 1
  return {
    id: `ent_teste_${sequence}`,
    description: 'Salário',
    amount: 100,
    date: '2026-08-05',
    categoryId: catA.id,
    recurring: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function expense(overrides: Partial<Expense> = {}): Expense {
  sequence += 1
  return {
    id: `sai_teste_${sequence}`,
    description: 'Conta',
    amount: 100,
    date: '2026-08-10',
    categoryId: catA.id,
    type: 'CONTA',
    status: 'PENDENTE',
    dueDate: null,
    paidAt: null,
    paymentMethod: 'PIX',
    cardId: null,
    recurring: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function card(): CreditCard {
  return {
    id: 'car_a',
    name: 'Alfa',
    brand: 'VISA',
    lastDigits: '1111',
    limit: 1000,
    closingDay: 20,
    dueDay: 27,
    color: '#000000',
    active: true,
    createdAt: '',
  }
}

beforeEach(async () => {
  db = await mockDb()
  db.incomes.length = 0
  db.expenses.length = 0
  db.invoices.length = 0
  db.cardTransactions.length = 0
  db.cards.length = 0
  db.cards.push(card())
  catA = db.categories[0]!
  catB = db.categories[1]!
})

describe('totais do período', () => {
  it('calcula totalIncome, totalExpenses e saldo apenas do mês', async () => {
    db.incomes.push(
      income({ amount: 1000 }),
      income({ amount: 500 }),
      income({ amount: 999, date: '2026-07-31' }),
      income({ amount: 999, date: '2026-09-01' }),
    )
    db.expenses.push(
      expense({ amount: 300 }),
      expense({ amount: 200 }),
      expense({ amount: 700, categoryId: catB.id }),
      expense({ amount: 999, date: '2026-07-31' }),
    )

    const summary = await dashboardService.summary(AUGUST)

    expect(summary.totalIncome).toBe(1500)
    expect(summary.totalExpenses).toBe(1200)
    expect(summary.balance).toBe(300)
  })

  it('saldo negativo quando as saídas superam as entradas', async () => {
    db.incomes.push(income({ amount: 100 }))
    db.expenses.push(expense({ amount: 350 }))

    const summary = await dashboardService.summary(AUGUST)

    expect(summary.balance).toBe(-250)
  })
})

describe('séries', () => {
  beforeEach(() => {
    db.incomes.push(
      income({ amount: 1000 }),
      income({ amount: 500 }),
      income({ amount: 600, date: '2026-07-10' }),
      income({ amount: 200, date: '2026-03-15' }),
      income({ amount: 999, date: '2026-02-28' }),
    )
    db.expenses.push(
      expense({ amount: 1200 }),
      expense({ amount: 400, date: '2026-07-20' }),
      expense({ amount: 50, date: '2026-06-01' }),
      expense({ amount: 999, date: '2026-02-28' }),
    )
  })

  it('tem 6 pontos, do mais antigo ao atual, com labels mmm/aa', async () => {
    const { incomeSeries, expenseSeries } = await dashboardService.summary(AUGUST)

    const labels = ['mar/26', 'abr/26', 'mai/26', 'jun/26', 'jul/26', 'ago/26']
    expect(incomeSeries.map((p) => p.label)).toEqual(labels)
    expect(expenseSeries.map((p) => p.label)).toEqual(labels)
  })

  it('soma cada mês e usa 0 nos meses sem movimento', async () => {
    const { incomeSeries, expenseSeries } = await dashboardService.summary(AUGUST)

    expect(incomeSeries.map((p) => p.value)).toEqual([200, 0, 0, 0, 600, 1500])
    expect(expenseSeries.map((p) => p.value)).toEqual([0, 0, 0, 50, 400, 1200])
  })

  it('atravessa a virada de ano', async () => {
    const { incomeSeries } = await dashboardService.summary({ month: 2, year: 2027 })

    expect(incomeSeries.map((p) => p.label)).toEqual([
      'set/26',
      'out/26',
      'nov/26',
      'dez/26',
      'jan/27',
      'fev/27',
    ])
  })
})

describe('variação', () => {
  it('compara com o mês anterior', async () => {
    db.incomes.push(income({ amount: 1500 }), income({ amount: 600, date: '2026-07-10' }))
    db.expenses.push(expense({ amount: 1200 }), expense({ amount: 400, date: '2026-07-20' }))

    const summary = await dashboardService.summary(AUGUST)

    expect(summary.incomeChange).toBe(1.5)
    expect(summary.expenseChange).toBe(2)
  })

  it('variação negativa quando o mês cai', async () => {
    db.incomes.push(income({ amount: 300 }), income({ amount: 600, date: '2026-07-10' }))

    const summary = await dashboardService.summary(AUGUST)

    expect(summary.incomeChange).toBe(-0.5)
  })

  it('mês anterior zerado vira 1 se houve movimento e 0 se não houve', async () => {
    db.incomes.push(income({ amount: 100 }))

    const summary = await dashboardService.summary(AUGUST)

    expect(summary.incomeChange).toBe(1)
    expect(summary.expenseChange).toBe(0)
  })
})

describe('totalInvoices', () => {
  it('soma só as saídas automáticas de cartão do mês', async () => {
    const augustInvoice = db.ensureInvoice('car_a', '2026-08')
    augustInvoice.total = 450
    const septemberInvoice = db.ensureInvoice('car_a', '2026-09')
    septemberInvoice.total = 999
    db.expenses.push(
      expense({ amount: 200 }),
      // Cartão de crédito, mas não é fatura derivada: não entra em totalInvoices.
      expense({ amount: 80, paymentMethod: 'CARTAO_CREDITO' }),
    )

    const summary = await dashboardService.summary(AUGUST)

    expect(summary.totalInvoices).toBe(450)
    expect(summary.totalExpenses).toBe(200 + 80 + 450)
  })

  it('é 0 sem faturas no mês', async () => {
    db.expenses.push(expense({ amount: 200 }))

    const summary = await dashboardService.summary(AUGUST)

    expect(summary.totalInvoices).toBe(0)
  })
})

describe('invoiceSeries', () => {
  it('traz só as faturas de cada mês, como recorte de expenseSeries', async () => {
    db.ensureInvoice('car_a', '2026-08').total = 450
    db.ensureInvoice('car_a', '2026-07').total = 300
    db.expenses.push(
      expense({ amount: 200 }),
      expense({ amount: 100, date: '2026-07-20' }),
      // Cartão de crédito, mas não é fatura derivada: fica só nas saídas.
      expense({ amount: 80, paymentMethod: 'CARTAO_CREDITO' }),
    )

    const { invoiceSeries, expenseSeries } = await dashboardService.summary(AUGUST)

    expect(invoiceSeries?.map((p) => p.label)).toEqual(expenseSeries.map((p) => p.label))
    expect(invoiceSeries?.map((p) => p.value)).toEqual([0, 0, 0, 0, 300, 450])
    expect(expenseSeries.at(-1)?.value).toBe(200 + 80 + 450)
  })

  it('é zerada sem faturas', async () => {
    db.expenses.push(expense({ amount: 200 }))

    const { invoiceSeries } = await dashboardService.summary(AUGUST)

    expect(invoiceSeries?.every((p) => p.value === 0)).toBe(true)
  })
})

describe('gastos de cartão', () => {
  function transaction(
    invoiceId: string,
    type: CardTransaction['type'],
    amount: number,
    categoryId = catA.id,
  ): CardTransaction {
    sequence += 1
    return {
      id: `tra_teste_${sequence}`,
      cardId: 'car_a',
      invoiceId,
      description: 'Compra',
      amount,
      date: '2026-08-01',
      categoryId,
      type,
      installment: 1,
      totalInstallments: 1,
      recurring: false,
      createdAt: '',
      updatedAt: '',
    }
  }

  it('agrupa as transações das faturas do mês por tipo, do maior para o menor, somando totalInvoices', async () => {
    const augustInvoice = db.ensureInvoice('car_a', '2026-08')
    const septemberInvoice = db.ensureInvoice('car_a', '2026-09')
    db.cardTransactions.push(
      transaction(augustInvoice.id, 'LAZER', 50),
      transaction(augustInvoice.id, 'ALIMENTACAO', 120),
      transaction(augustInvoice.id, 'LAZER', 30),
      // Fatura que vence em outro mês: fica de fora.
      transaction(septemberInvoice.id, 'COMPRAS', 999),
    )
    db.recalculateInvoiceTotal(augustInvoice.id)
    db.recalculateInvoiceTotal(septemberInvoice.id)

    const summary = await dashboardService.summary(AUGUST)

    expect(summary.cardExpensesByType).toEqual([
      { type: 'ALIMENTACAO', total: 120 },
      { type: 'LAZER', total: 80 },
    ])
    expect(summary.totalInvoices).toBe(200)
  })

  it('agrupa as mesmas transações por categoria, com nome e cor, e "Outros" para categoria desconhecida', async () => {
    const augustInvoice = db.ensureInvoice('car_a', '2026-08')
    const septemberInvoice = db.ensureInvoice('car_a', '2026-09')
    db.cardTransactions.push(
      transaction(augustInvoice.id, 'LAZER', 50, catA.id),
      transaction(augustInvoice.id, 'ALIMENTACAO', 120, catB.id),
      transaction(augustInvoice.id, 'LAZER', 30, catA.id),
      transaction(augustInvoice.id, 'OUTROS', 10, 'cat_inexistente'),
      transaction(septemberInvoice.id, 'COMPRAS', 999, catA.id),
    )
    // Saída comum: fica em gastosPorCategoria, nunca nos gastos de cartão.
    db.expenses.push(expense({ amount: 500, categoryId: catB.id }))

    const summary = await dashboardService.summary(AUGUST)

    expect(summary.cardExpensesByCategory).toEqual([
      { name: catB.name, color: catB.color, total: 120 },
      { name: catA.name, color: catA.color, total: 80 },
      { name: 'Outros', color: DEFAULT_COLOR, total: 10 },
    ])
  })

  it('devolve listas vazias sem fatura no mês', async () => {
    db.expenses.push(expense({ amount: 200, type: 'LAZER' }))

    const summary = await dashboardService.summary(AUGUST)

    expect(summary.cardExpensesByType).toEqual([])
    expect(summary.cardExpensesByCategory).toEqual([])
  })
})

describe('incomeByCategory', () => {
  it('agrupa entradas do período por categoria, ordena por total e ignora outros meses', async () => {
    db.incomes.push(
      income({ amount: 300, categoryId: catA.id }),
      income({ amount: 200, categoryId: catA.id }),
      income({ amount: 700, categoryId: catB.id }),
      income({ amount: 999, categoryId: catB.id, date: '2026-07-10' }),
    )

    const { incomeByCategory } = await dashboardService.summary(AUGUST)

    expect(incomeByCategory).toEqual([
      { name: catB.name, color: catB.color, total: 700 },
      { name: catA.name, color: catA.color, total: 500 },
    ])
  })

  it('devolve lista vazia sem entradas no período', async () => {
    const { incomeByCategory } = await dashboardService.summary(AUGUST)
    expect(incomeByCategory).toEqual([])
  })
})

describe('expensesByCategory', () => {
  it('agrupa por categoria, ordena do maior para o menor e cai em "Outros" para categoria desconhecida', async () => {
    db.expenses.push(
      expense({ amount: 300, categoryId: catA.id }),
      expense({ amount: 200, categoryId: catA.id }),
      expense({ amount: 700, categoryId: catB.id }),
      expense({ amount: 100, categoryId: 'cat_inexistente' }),
      expense({ amount: 999, categoryId: catB.id, date: '2026-07-10' }),
    )

    const { expensesByCategory } = await dashboardService.summary(AUGUST)

    expect(expensesByCategory).toEqual([
      { name: catB.name, color: catB.color, total: 700 },
      { name: catA.name, color: catA.color, total: 500 },
      { name: 'Outros', color: DEFAULT_COLOR, total: 100 },
    ])
  })

  it('soma dos gastos por categoria é igual ao total de saídas', async () => {
    db.expenses.push(expense({ amount: 300 }), expense({ amount: 700, categoryId: catB.id }))
    db.ensureInvoice('car_a', '2026-08').total = 450

    const summary = await dashboardService.summary(AUGUST)

    const sum = summary.expensesByCategory.reduce((acc, g) => acc + g.total, 0)
    expect(sum).toBe(summary.totalExpenses)
    expect(summary.totalExpenses).toBe(1450)
  })
})

describe('recentTransactions', () => {
  it('mistura entradas e saídas do mês, da data mais recente para a mais antiga, no máximo 8', async () => {
    for (let day = 1; day <= 5; day += 1) {
      db.incomes.push(income({ id: `e${day}`, date: `2026-08-0${day}` }))
    }
    for (let day = 6; day <= 10; day += 1) {
      const date = day === 10 ? '2026-08-10' : `2026-08-0${day}`
      db.expenses.push(expense({ id: `s${day}`, date }))
    }
    db.incomes.push(income({ id: 'fora', date: '2026-07-31' }))

    const { recentTransactions } = await dashboardService.summary(AUGUST)

    expect(recentTransactions).toHaveLength(8)
    expect(recentTransactions.map((t) => t.id)).toEqual(['s10', 's9', 's8', 's7', 's6', 'e5', 'e4', 'e3'])
    expect(recentTransactions.map((t) => t.movement)).toEqual([
      'SAIDA',
      'SAIDA',
      'SAIDA',
      'SAIDA',
      'SAIDA',
      'ENTRADA',
      'ENTRADA',
      'ENTRADA',
    ])
  })

  it('traz nome e cor da categoria, com "Sem categoria" e cor padrão para desconhecida', async () => {
    db.incomes.push(income({ id: 'e1', categoryId: catA.id, date: '2026-08-02' }))
    db.expenses.push(expense({ id: 's1', categoryId: 'cat_inexistente', date: '2026-08-01' }))

    const { recentTransactions } = await dashboardService.summary(AUGUST)

    expect(recentTransactions[0]).toMatchObject({
      id: 'e1',
      movement: 'ENTRADA',
      categoryName: catA.name,
      categoryColor: catA.color,
    })
    expect(recentTransactions[1]).toMatchObject({
      id: 's1',
      movement: 'SAIDA',
      categoryName: 'Sem categoria',
      categoryColor: DEFAULT_COLOR,
    })
  })

  it('inclui a fatura de cartão do mês como saída', async () => {
    db.ensureInvoice('car_a', '2026-08').total = 450

    const { recentTransactions } = await dashboardService.summary(AUGUST)

    expect(recentTransactions).toHaveLength(1)
    expect(recentTransactions[0]).toMatchObject({ movement: 'SAIDA', amount: 450, description: 'Fatura – Alfa' })
  })
})

describe('período sem dados', () => {
  it('devolve zeros e listas vazias, sem lançar', async () => {
    const summary = await dashboardService.summary(AUGUST)

    expect(summary).toMatchObject({
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      totalInvoices: 0,
      incomeChange: 0,
      expenseChange: 0,
      expensesByCategory: [],
      incomeByCategory: [],
      recentTransactions: [],
    })
    expect(summary.incomeSeries).toHaveLength(6)
    expect(summary.expenseSeries).toHaveLength(6)
    expect(summary.incomeSeries.every((p) => p.value === 0)).toBe(true)
    expect(summary.expenseSeries.every((p) => p.value === 0)).toBe(true)
  })
})
