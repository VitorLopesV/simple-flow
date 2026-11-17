import type { ID, SeriesPoint } from './common'
import type { PaymentMethod } from './expense'
import type { Scoreboard } from './sprint'
import type { TaskDifficulty, TaskEstimate, TaskPriority } from './task'

/** Item de rotina do dia (missão) ou lembrete de fim de semana, como a Home os recebe. */
export interface HomeOccurrence {
  /** `null` só se o sprint ainda não gravou a ocorrência (nada a concluir). */
  id: ID | null
  name: string
  /** `YYYY-MM-DD` */
  date: string
  /** `HH:MM` */
  time: string | null
  done: boolean
  completedAt: string | null
}

/** Tarefa de hoje. `overdue` já vem calculado pelo backend (mesma regra de `wouldBeLate`). */
export interface HomeTask {
  id: ID
  title: string
  areaId: ID
  day: string
  time: string | null
  estimateMinutes: TaskEstimate | null
  difficulty: TaskDifficulty | null
  priority: TaskPriority | null
  /** `false` = só planejada para hoje, não pontua no sprint. */
  inSprint: boolean
  done: boolean
  completedAt: string | null
  overdue: boolean
}

/** Placar enxuto da Home: o detalhe de rotina e tarefas fica na página Sprint. */
export interface HomeScoreboard extends Pick<Scoreboard, 'total' | 'done' | 'percentage' | 'bonus'> {
  sprintId: ID
  startDate: string
  endDate: string
  /** No fim de semana o sprint "atual" é o fechado: o placar é a foto do fechamento. */
  closed: boolean
  closedAt: string | null
  reward: string | null
}

export interface HomeBill {
  id: ID
  description: string
  amount: number
  /** `YYYY-MM-DD` */
  dueDate: string
  overdue: boolean
  /** Fatura de cartão (saída derivada). */
  automatic: boolean
  categoryId: ID
  paymentMethod: PaymentMethod
}

export interface HomeFinances {
  /** Competência `YYYY-MM`. */
  referenceMonth: string
  totalIncome: number
  totalExpenses: number
  balance: number
  totalInvoices: number
  incomeChange: number
  expenseChange: number
  incomeSeries: SeriesPoint[]
  expenseSeries: SeriesPoint[]
}

/** Resposta de `GET /home/resumo`. */
export interface HomeSummary {
  today: string
  weekend: boolean
  week: { start: string; end: string }
  mission: { total: number; completed: number; occurrences: HomeOccurrence[] }
  todayTasks: HomeTask[]
  scoreboard: HomeScoreboard
  weekBills: { total: number; count: number; bills: HomeBill[] }
  finances: HomeFinances
  reminders: HomeOccurrence[]
}
