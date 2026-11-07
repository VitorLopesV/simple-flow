import type { Category } from '@/types/category'
import type { ID } from '@/types/common'
import type { CardTransaction, CreditCardWithInvoice } from '@/types/creditCard'
import type { Expense, ExpenseType } from '@/types/expense'
import { EXPENSE_TYPE_COLOR, EXPENSE_TYPE_LABEL, isExpenseOverdue } from '@/types/expense'
import type { Income } from '@/types/income'
import { toISODate } from '@/utils/dateFormatter'

/** Cor das categorias sem cadastro (ou removidas) nos gráficos do PDF. */
const FALLBACK_COLOR = '#94a3b8'
const FALLBACK_NAME = 'Sem categoria'

export interface ReportGroup<T> {
  categoryId: ID
  name: string
  color: string
  total: number
  items: T[]
}

export interface StatusTotal {
  amount: number
  count: number
}

export interface TypeSlice {
  type: ExpenseType
  label: string
  color: string
  total: number
  /** 0-100. */
  percent: number
}

export interface CategoryBar {
  name: string
  color: string
  total: number
}

export interface ReportData {
  totals: {
    income: number
    /** Saídas pagas direto (Pix, boleto, débito...), sem as faturas de cartão. */
    cashExpenses: number
    /** Soma das faturas dos cartões no mês. */
    invoices: number
    /** Entradas − saídas à vista − faturas. */
    balance: number
  }
  /** Situação das saídas à vista (faturas têm situação própria, no bloco do cartão). */
  status: { paid: StatusTotal; pending: StatusTotal; overdue: StatusTotal }
  incomeGroups: ReportGroup<Income>[]
  expenseGroups: ReportGroup<Expense>[]
  incomeBars: CategoryBar[]
  /** Saídas à vista + transações de cartão, por categoria. */
  expenseBars: CategoryBar[]
  /** Saídas à vista + transações de cartão, por tipo. */
  typeSlices: TypeSlice[]
  cards: CreditCardWithInvoice[]
}

export interface ReportInput {
  incomes: Income[]
  expenses: Expense[]
  cards: CreditCardWithInvoice[]
  categories: Category[]
  /** `YYYY-MM-DD`; define o que está vencido. Padrão: hoje. */
  today?: string
}

function sum(values: { amount: number }[]): number {
  return values.reduce((total, item) => total + item.amount, 0)
}

/**
 * A fatura do cartão também chega na listagem de saídas, como uma saída derivada
 * (`automatic` + `CARTAO_CREDITO`; ver `invoicesAsExpenses` em mock/db.ts). Ela não é
 * "à vista": entra no relatório pela fatura do cartão, senão o gasto seria contado duas vezes.
 */
export function isInvoiceExpense(expense: Pick<Expense, 'automatic' | 'paymentMethod'>): boolean {
  return Boolean(expense.automatic) && expense.paymentMethod === 'CARTAO_CREDITO'
}

/** Agrupa por categoria, com a ordem decrescente de total e itens por data. */
function groupByCategory<T extends { categoryId: ID; amount: number; date: string }>(
  items: T[],
  categories: Category[],
): ReportGroup<T>[] {
  const groups = new Map<ID, ReportGroup<T>>()

  for (const item of items) {
    let group = groups.get(item.categoryId)
    if (!group) {
      const category = categories.find((entry) => entry.id === item.categoryId)
      group = {
        categoryId: item.categoryId,
        name: category?.name ?? FALLBACK_NAME,
        color: category?.color ?? FALLBACK_COLOR,
        total: 0,
        items: [],
      }
      groups.set(item.categoryId, group)
    }
    group.items.push(item)
    group.total += item.amount
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: group.items.slice().sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'))
}

function toBars(groups: ReportGroup<{ amount: number }>[]): CategoryBar[] {
  return groups.map(({ name, color, total }) => ({ name, color, total }))
}

/** Monta tudo o que o PDF mostra a partir dos registros do mês, sem tocar em rede nem em PDF. */
export function buildReportData(input: ReportInput): ReportData {
  const { incomes, cards, categories } = input
  const today = input.today ?? toISODate(new Date())

  const cashExpenses = input.expenses.filter((expense) => !isInvoiceExpense(expense))
  const cardTransactions: CardTransaction[] = cards.flatMap(
    ({ invoice }) => invoice?.transactions ?? [],
  )

  const status = {
    paid: { amount: 0, count: 0 },
    pending: { amount: 0, count: 0 },
    overdue: { amount: 0, count: 0 },
  }
  for (const expense of cashExpenses) {
    const bucket = isExpenseOverdue(expense, today)
      ? status.overdue
      : expense.status === 'PAGO'
        ? status.paid
        : status.pending
    bucket.amount += expense.amount
    bucket.count += 1
  }

  const totalIncome = sum(incomes)
  const totalCash = sum(cashExpenses)
  const totalInvoices = cards.reduce((total, { invoice }) => total + (invoice?.total ?? 0), 0)

  const incomeGroups = groupByCategory(incomes, categories)
  const expenseGroups = groupByCategory(cashExpenses, categories)
  const allExpenseGroups = groupByCategory([...cashExpenses, ...cardTransactions], categories)

  const byType = new Map<ExpenseType, number>()
  for (const item of [...cashExpenses, ...cardTransactions]) {
    byType.set(item.type, (byType.get(item.type) ?? 0) + item.amount)
  }
  const typeTotal = [...byType.values()].reduce((total, value) => total + value, 0)
  const typeSlices = [...byType.entries()]
    .map(([type, total]) => ({
      type,
      label: EXPENSE_TYPE_LABEL[type] ?? type,
      color: EXPENSE_TYPE_COLOR[type] ?? FALLBACK_COLOR,
      total,
      percent: typeTotal > 0 ? (total / typeTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    totals: {
      income: totalIncome,
      cashExpenses: totalCash,
      invoices: totalInvoices,
      balance: totalIncome - totalCash - totalInvoices,
    },
    status,
    incomeGroups,
    expenseGroups,
    incomeBars: toBars(incomeGroups),
    expenseBars: toBars(allExpenseGroups),
    typeSlices,
    cards,
  }
}
