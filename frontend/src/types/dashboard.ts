import type { Movement } from './category'
import type { ID, SeriesPoint } from './common'
import type { ExpenseType } from './expense'

export interface RecentTransaction {
  id: ID
  movement: Movement
  description: string
  amount: number
  date: string
  categoryName: string
  categoryColor: string
}

/** Total agrupado por categoria, com nome e cor prontos para o gráfico. */
export interface CategoryTotal {
  name: string
  color: string
  total: number
}

export interface DashboardSummary {
  totalIncome: number
  totalExpenses: number
  balance: number
  /**
   * Quanto de `totalExpenses` é fatura de cartão — recorte do mesmo conjunto, pelo
   * mês de vencimento da fatura, não pela competência.
   */
  totalInvoices: number
  incomeChange: number
  expenseChange: number
  /** Últimos 6 meses de entradas e saídas. */
  incomeSeries: SeriesPoint[]
  expenseSeries: SeriesPoint[]
  /**
   * Últimos 6 meses só de faturas de cartão — recorte de `expenseSeries`, não soma a mais.
   * Opcional: um backend que ainda não devolva a série é tratado como "sem cartão".
   */
  invoiceSeries?: SeriesPoint[]
  /** Distribuição das saídas por categoria no período. */
  expensesByCategory: CategoryTotal[]
  /** Distribuição das entradas por categoria no período. */
  incomeByCategory: CategoryTotal[]
  /**
   * Transações lançadas nos cartões, agrupadas por `ExpenseType` — só as das faturas que
   * entram em `totalInvoices` (mesma regra de mês), então a soma bate com ele.
   * Opcional: um backend que ainda não devolva o campo é tratado como "sem cartão".
   */
  cardExpensesByType?: { type: ExpenseType; total: number }[]
  /** Mesmas transações de `cardExpensesByType`, agrupadas por categoria. Opcional pelo mesmo motivo. */
  cardExpensesByCategory?: CategoryTotal[]
  recentTransactions: RecentTransaction[]
}
