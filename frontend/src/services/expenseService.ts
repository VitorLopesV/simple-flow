import type { Paginated, Period } from '@/types/common'
import type { ExpenseDto, ExpenseSummaryDto } from '@/types/dto'
import type { Expense, ExpenseFilter, ExpensePayload, ExpenseSummary, ExpenseType } from '@/types/expense'
import { addMonths, isWithinPeriod, toReferenceMonth } from '@/utils/dateFormatter'
import { http, USE_MOCK } from './http'
import { mapPage, toExpense, toExpensePayloadDto, toExpenseSummary } from './mappers'
import { delay, matchesSearch, mockDb, paginate } from './mock'

/**
 * Ordena saídas por vencimento primeiro: as que têm data de vencimento vêm
 * antes, da mais próxima para a mais distante; as sem vencimento vêm depois,
 * ordenadas pela data de lançamento mais recente primeiro.
 */
export function compareExpensesByDueDate(a: Expense, b: Expense): number {
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
  if (a.dueDate) return -1
  if (b.dueDate) return 1
  return b.date.localeCompare(a.date)
}

export const expenseService = {
  async list(filter: ExpenseFilter): Promise<Paginated<Expense>> {
    if (USE_MOCK) {
      const db = await mockDb()
      const found = db
        .expensesWithInvoices()
        .filter((expense) => isWithinPeriod(expense.date, filter.period))
        .filter((expense) => !filter.categoryId || expense.categoryId === filter.categoryId)
        .filter((expense) => !filter.status || expense.status === filter.status)
        .filter((expense) => matchesSearch(`${expense.description} ${expense.notes ?? ''}`, filter.search))
        .sort(compareExpensesByDueDate)

      return delay(paginate(db.clone(found), filter))
    }

    const { data } = await http.get<Paginated<ExpenseDto>>('/saidas', {
      params: {
        mes: filter.period.month,
        ano: filter.period.year,
        categoriaId: filter.categoryId ?? undefined,
        status: filter.status ?? undefined,
        busca: filter.search || undefined,
        page: filter.page,
        pageSize: filter.pageSize,
      },
    })
    return mapPage(data, toExpense)
  },

  async summary(period: Period): Promise<ExpenseSummary> {
    if (USE_MOCK) {
      const db = await mockDb()
      const all = db.expensesWithInvoices()

      const periodTotal = (target: Period) =>
        all
          .filter((expense) => isWithinPeriod(expense.date, target))
          .reduce((sum, expense) => sum + expense.amount, 0)

      const inPeriod = all.filter((expense) => isWithinPeriod(expense.date, period))
      const total = inPeriod.reduce((sum, expense) => sum + expense.amount, 0)

      const grouped = new Map<string, number>()
      for (const expense of inPeriod) {
        grouped.set(expense.categoryId, (grouped.get(expense.categoryId) ?? 0) + expense.amount)
      }

      const byCategory = [...grouped.entries()]
        .map(([categoryId, amount]) => {
          const category = db.categories.find((item) => item.id === categoryId)
          return {
            categoryId,
            name: category?.name ?? 'Sem categoria',
            color: category?.color ?? '#94a3b8',
            total: amount,
          }
        })
        .sort((a, b) => b.total - a.total)

      const groupedByType = new Map<ExpenseType, number>()
      for (const expense of inPeriod) {
        groupedByType.set(expense.type, (groupedByType.get(expense.type) ?? 0) + expense.amount)
      }

      const byType = [...groupedByType.entries()]
        .map(([type, amount]) => ({ type, total: amount }))
        .sort((a, b) => b.total - a.total)

      return delay({
        total,
        count: inPeriod.length,
        average: inPeriod.length ? total / inPeriod.length : 0,
        paidTotal: inPeriod
          .filter((expense) => expense.status === 'PAGO')
          .reduce((sum, expense) => sum + expense.amount, 0),
        pendingTotal: inPeriod
          .filter((expense) => expense.status === 'PENDENTE')
          .reduce((sum, expense) => sum + expense.amount, 0),
        previousMonthTotal: periodTotal(addMonths(period, -1)),
        byCategory,
        byType,
      })
    }

    const { data } = await http.get<ExpenseSummaryDto>('/saidas/resumo', {
      params: { competencia: toReferenceMonth(period) },
    })
    return toExpenseSummary(data)
  },

  async create(payload: ExpensePayload): Promise<Expense> {
    if (USE_MOCK) {
      const db = await mockDb()
      // Mesmas regras do backend: recorrência só em Despesa Fixa, e criar um registro
      // recorrente já cria o do mês seguinte (registro próprio, mesma série, PENDENTE).
      if (payload.recurring && !db.isFixedCategoryId(payload.categoryId)) {
        throw new Error(db.RECURRING_ONLY_FIXED)
      }

      // `paidAt` espelha a regra do backend: nunca vem do formulário, é definida
      // aqui a partir da situação escolhida (ver CriarSaida no backend).
      const expense: Expense = {
        ...payload,
        paidAt: payload.status === 'PAGO' ? db.todayISO : null,
        seriesId: payload.recurring ? db.newId('ser') : null,
        id: db.newId('sai'),
        createdAt: db.now(),
        updatedAt: db.now(),
      }
      db.expenses.push(expense)
      db.ensureNextExpense(expense)
      return delay(db.clone(expense))
    }

    const { data } = await http.post<ExpenseDto>('/saidas', toExpensePayloadDto(payload))
    return toExpense(data)
  },

  async update(id: string, payload: ExpensePayload): Promise<Expense> {
    if (USE_MOCK) {
      const db = await mockDb()
      const index = db.expenses.findIndex((expense) => expense.id === id)
      if (index < 0) throw new Error('Saída não encontrada.')

      const current = db.expenses[index]!
      // Mesma regra do backend (ver AtualizarSaida): mantém a data de pagamento
      // original se já estava paga, carimba hoje ao virar paga, limpa ao pendenciar.
      const paidAt =
        payload.status !== 'PAGO'
          ? null
          : (current.status === 'PAGO' ? current.paidAt : null) ?? db.todayISO

      // Trocar para uma categoria não fixa conta como desligar a recorrência.
      const recurring = payload.recurring && db.isFixedCategoryId(payload.categoryId)
      // Nome de uma saída recorrente é imutável — só muda quando ela deixa de ser recorrente.
      const description = current.recurring && recurring ? current.description : payload.description

      const updated: Expense = {
        ...current,
        ...payload,
        recurring,
        description,
        paidAt,
        // Religar a recorrência mantém a série original (ou abre uma, se nunca teve).
        seriesId: current.seriesId ?? (recurring ? db.newId('ser') : null),
        updatedAt: db.now(),
      }
      db.expenses[index] = updated

      // Desligar encerra a série a partir do mês seguinte; religar volta a gerar o próximo mês.
      if (current.recurring && !recurring) db.removeRecords(db.expenses, db.laterInSeries(db.expenses, current))
      if (!current.recurring && recurring) db.ensureNextExpense(updated)

      return delay(db.clone(updated))
    }

    const { data } = await http.put<ExpenseDto>(`/saidas/${id}`, toExpensePayloadDto(payload))
    return toExpense(data)
  },

  async remove(id: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const expense = db.expenses.find((item) => item.id === id)
      if (!expense) throw new Error('Saída não encontrada.')
      // Excluir um mês da série remove ele e os seguintes; os anteriores ficam intactos.
      db.removeRecords(db.expenses, [expense, ...db.laterInSeries(db.expenses, expense)])
      return delay(undefined)
    }

    await http.delete(`/saidas/${id}`)
  },
}
