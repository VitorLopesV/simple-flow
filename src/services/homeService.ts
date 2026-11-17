import type { HomeSummaryDto } from '@/types/dto'
import type { HomeBill, HomeOccurrence, HomeSummary, HomeTask } from '@/types/home'
import type { RoutineOccurrence } from '@/types/sprint'
import type { Task } from '@/types/task'
import { currentPeriod, toISODate } from '@/utils/dateFormatter'
import { addDays, mondayOf } from '@/utils/sprint'
import { wouldBeLate } from '@/utils/taskCompletion'
import { dashboardService } from './dashboardService'
import { http, USE_MOCK } from './http'
import { toHomeSummary } from './mappers'
import { delay, mockDb } from './mock'
import { sprintService } from './sprintService'

/** Hora crescente, sem hora no fim; o empate fica por conta de quem chama. */
function byTime(a: { time: string | null }, b: { time: string | null }): number {
  if (a.time === b.time) return 0
  if (a.time === null) return 1
  if (b.time === null) return -1
  return a.time.localeCompare(b.time)
}

function toOccurrence(entry: RoutineOccurrence): HomeOccurrence {
  return {
    id: entry.id,
    name: entry.name,
    date: entry.date,
    time: entry.time,
    done: entry.completedAt !== null,
    completedAt: entry.completedAt,
  }
}

function toHomeTask(task: Task, day: string): HomeTask {
  return {
    id: task.id,
    title: task.title,
    areaId: task.areaId,
    day,
    time: task.time,
    estimateMinutes: task.estimateMinutes,
    difficulty: task.difficulty,
    priority: task.priority,
    inSprint: task.sprintId !== null,
    done: task.done,
    completedAt: task.completedAt,
    // Concluída: a regra da conclusão; pendente: o prazo já passou neste instante (como no backend).
    overdue: task.done ? task.late : wouldBeLate(task),
  }
}

export const homeService = {
  /**
   * Tudo o que a Home mostra numa chamada. O mock monta a resposta a partir dos mesmos dados
   * dos outros services, com as regras do backend (#74): no fim de semana o sprint "atual" é o
   * fechado (missão do dia vazia, placar é a foto do fechamento) e a semana vai de segunda a domingo.
   */
  async summary(): Promise<HomeSummary> {
    if (USE_MOCK) {
      const db = await mockDb()
      const today = toISODate(new Date())
      const monday = mondayOf(today)
      const sunday = addDays(monday, 6)

      const [view, board, finances] = await Promise.all([
        sprintService.get('current'),
        sprintService.getScoreboard('current'),
        dashboardService.summary(currentPeriod()),
      ])

      const occurrences = view.occurrences
        .filter((entry) => entry.date === today)
        .sort((a, b) => byTime(a, b) || a.order - b.order)
        .map(toOccurrence)

      const todayTasks = db.tasks
        .filter((task) => !task.archived && task.day === today)
        .sort((a, b) => byTime(a, b) || a.title.localeCompare(b.title, 'pt-BR'))
        .map((task) => toHomeTask(task, today))

      const bills: HomeBill[] = db
        .expensesWithInvoices()
        .filter(
          (expense) =>
            expense.status === 'PENDENTE' && expense.dueDate && expense.dueDate >= monday && expense.dueDate <= sunday,
        )
        .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.description.localeCompare(b.description, 'pt-BR'))
        .map((expense) => ({
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          dueDate: expense.dueDate!,
          overdue: expense.dueDate! < today,
          automatic: Boolean(expense.automatic),
          categoryId: expense.categoryId,
          paymentMethod: expense.paymentMethod,
        }))

      const reminders = [...view.reminders]
        .sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b))
        .map(toOccurrence)

      return delay({
        today,
        weekend: view.sprint.status === 'FECHADO',
        week: { start: monday, end: sunday },
        mission: {
          total: occurrences.length,
          completed: occurrences.filter((entry) => entry.done).length,
          occurrences,
        },
        todayTasks,
        scoreboard: {
          sprintId: board.sprintId,
          startDate: board.startDate,
          endDate: board.endDate,
          closed: board.closed,
          closedAt: board.closed ? `${addDays(monday, 4)}T23:59:00.000Z` : null,
          total: board.scoreboard.total,
          done: board.scoreboard.done,
          percentage: board.scoreboard.percentage,
          bonus: board.scoreboard.bonus,
          reward: board.reward,
        },
        weekBills: {
          total: Math.round(bills.reduce((sum, bill) => sum + bill.amount, 0) * 100) / 100,
          count: bills.length,
          bills,
        },
        finances: {
          referenceMonth: today.slice(0, 7),
          totalIncome: finances.totalIncome,
          totalExpenses: finances.totalExpenses,
          balance: finances.balance,
          totalInvoices: finances.totalInvoices,
          incomeChange: finances.incomeChange,
          expenseChange: finances.expenseChange,
          incomeSeries: finances.incomeSeries,
          expenseSeries: finances.expenseSeries,
        },
        reminders,
      })
    }

    const { data } = await http.get<HomeSummaryDto>('/home/resumo')
    return toHomeSummary(data)
  },
}
