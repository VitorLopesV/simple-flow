import type { Period, SeriesPoint } from '@/types/common'
import type { DashboardSummary, RecentTransaction } from '@/types/dashboard'
import type { DashboardSummaryDto } from '@/types/dto'
import type { ExpenseType } from '@/types/expense'
import { calculateChange } from '@/utils/currencyFormatter'
import {
  isWithinPeriod,
  lastPeriods,
  shortPeriodLabel,
  toReferenceMonth,
} from '@/utils/dateFormatter'
import { http, USE_MOCK } from './http'
import { toDashboardSummary } from './mappers'
import { delay, mockDb } from './mock'

const MONTHS_IN_CHART = 6

function sum(values: { amount: number }[]): number {
  return values.reduce((total, item) => total + item.amount, 0)
}

function series(records: { date: string; amount: number }[], period: Period): SeriesPoint[] {
  return lastPeriods(period, MONTHS_IN_CHART).map((month) => ({
    label: shortPeriodLabel(month),
    value: sum(records.filter((record) => isWithinPeriod(record.date, month))),
  }))
}

function isInvoice(expense: { automatic?: boolean; paymentMethod?: string }): boolean {
  return Boolean(expense.automatic) && expense.paymentMethod === 'CARTAO_CREDITO'
}

export const dashboardService = {
  async summary(period: Period): Promise<DashboardSummary> {
    if (USE_MOCK) {
      const db = await mockDb()

      const allExpenses = db.expensesWithInvoices()
      const monthIncomes = db.incomes.filter((income) => isWithinPeriod(income.date, period))
      const monthExpenses = allExpenses.filter((expense) => isWithinPeriod(expense.date, period))

      const totalIncome = sum(monthIncomes)
      const totalExpenses = sum(monthExpenses)

      const incomeSeries = series(db.incomes, period)
      const expenseSeries = series(allExpenses, period)
      const invoiceSeries = series(allExpenses.filter(isInvoice), period)

      // Quanto das saídas do mês é fatura de cartão — sai do mesmo conjunto que alimenta
      // totalExpenses (ver `invoicesAsExpenses` em mock/db.ts), e não de uma busca própria
      // por competência, que seria uma definição de mês diferente do resto do dashboard.
      const totalInvoices = monthExpenses
        .filter(isInvoice)
        .reduce((total, expense) => total + expense.amount, 0)

      const category = (id: string) => db.categories.find((item) => item.id === id)

      const byCategory = (records: { categoryId: string; amount: number }[]) => {
        const grouped = new Map<string, number>()
        for (const record of records) {
          grouped.set(record.categoryId, (grouped.get(record.categoryId) ?? 0) + record.amount)
        }

        return [...grouped.entries()]
          .map(([categoryId, total]) => ({
            name: category(categoryId)?.name ?? 'Outros',
            color: category(categoryId)?.color ?? '#94a3b8',
            total,
          }))
          .sort((a, b) => b.total - a.total)
      }

      const expensesByCategory = byCategory(monthExpenses)
      const incomeByCategory = byCategory(monthIncomes)

      // Mesma regra de mês de `totalInvoices`: a fatura vira saída na data de vencimento
      // (ver `invoicesAsExpenses` em mock/db.ts), não pela competência.
      const monthInvoices = new Set(
        db.invoices
          .filter((invoice) => isWithinPeriod(invoice.dueDate, period))
          .map((invoice) => invoice.id),
      )
      const monthCardTransactions = db.cardTransactions.filter((transaction) =>
        monthInvoices.has(transaction.invoiceId),
      )

      const groupedByType = new Map<ExpenseType, number>()
      for (const transaction of monthCardTransactions) {
        groupedByType.set(transaction.type, (groupedByType.get(transaction.type) ?? 0) + transaction.amount)
      }
      const cardExpensesByType = [...groupedByType.entries()]
        .map(([type, total]) => ({ type, total }))
        .sort((a, b) => b.total - a.total)
      const cardExpensesByCategory = byCategory(monthCardTransactions)

      // Última ação de cada registro; sem histórico (dado semeado ou gerado pela recorrência),
      // vale "adicionado" na data de criação. Removidos só existem no histórico.
      const lastActivity = new Map<string, (typeof db.activityLog)[number]>()
      for (const entry of db.activityLog) lastActivity.set(entry.record.id, entry)

      const toRecent = (
        kind: RecentTransaction['movement'],
        record: { id: string; description: string; amount: number; date: string; categoryId: string; createdAt: string },
      ): RecentTransaction => {
        const last = lastActivity.get(record.id)
        return {
          id: record.id,
          movement: kind,
          action: last?.action ?? 'ADICIONADO',
          occurredAt: last?.at ?? record.createdAt,
          description: record.description,
          amount: record.amount,
          date: record.date,
          categoryName: category(record.categoryId)?.name ?? 'Sem categoria',
          categoryColor: category(record.categoryId)?.color ?? '#94a3b8',
        }
      }

      const liveIds = new Set<string>([
        ...db.incomes.map((income) => income.id),
        ...allExpenses.map((expense) => expense.id),
        ...db.cardTransactions.map((transaction) => transaction.id),
      ])

      const recentTransactions: RecentTransaction[] = [
        ...monthIncomes.map((income) => toRecent('ENTRADA', income)),
        // A fatura vira uma saída derivada; no dashboard ela é movimentação de cartão.
        ...monthExpenses.map((expense) => toRecent(isInvoice(expense) ? 'CARTAO' : 'SAIDA', expense)),
        // Lançamentos de cartão entram pela data da compra: a saída da fatura (acima) só
        // mostra o total, e o usuário quer ver cada compra no cartão como movimentação.
        ...db.cardTransactions
          .filter((transaction) => isWithinPeriod(transaction.date, period))
          .map((transaction) => toRecent('CARTAO', transaction)),
        // Registros removidos: o que restou é a cópia guardada no histórico.
        ...[...lastActivity.values()]
          .filter(
            (entry) =>
              entry.action === 'REMOVIDO' &&
              !liveIds.has(entry.record.id) &&
              isWithinPeriod(entry.record.date, period),
          )
          .map((entry) => toRecent(entry.kind, { ...entry.record, createdAt: entry.at })),
      ]
        .sort(
          (a, b) =>
            (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '') || b.date.localeCompare(a.date),
        )
        .slice(0, 8)

      return delay({
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
        totalInvoices,
        incomeChange: calculateChange(totalIncome, incomeSeries.at(-2)?.value ?? 0),
        expenseChange: calculateChange(totalExpenses, expenseSeries.at(-2)?.value ?? 0),
        incomeSeries,
        expenseSeries,
        invoiceSeries,
        expensesByCategory,
        incomeByCategory,
        cardExpensesByType,
        cardExpensesByCategory,
        recentTransactions,
      })
    }

    const { data } = await http.get<DashboardSummaryDto>('/dashboard/resumo', {
      params: { competencia: toReferenceMonth(period) },
    })
    return toDashboardSummary(data)
  },
}
