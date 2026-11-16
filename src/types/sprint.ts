import type { ID } from './common'

/** Qual sprint a tela mostra: o da semana de hoje ou o da semana seguinte (planejamento). */
export type SprintWhich = 'current' | 'next'

/** Os valores de `SprintStatus` são os gravados na API, por isso continuam em português. */
export type SprintStatus = 'ABERTO' | 'FECHADO'

/** Semana de trabalho: `startDate` é a segunda e `endDate` a sexta (`YYYY-MM-DD`). */
export interface Sprint {
  id: ID
  startDate: string
  endDate: string
  status: SprintStatus
  startedRoutineAt: string | null
  createdAt: string
}

/** Vez de um item de rotina num dia: a "missão do dia". */
export interface RoutineOccurrence {
  /** `null` na prévia (sprint que ainda não começou): nada foi gravado. */
  id: ID | null
  itemId: ID | null
  name: string
  /** `YYYY-MM-DD` */
  date: string
  /** `HH:MM` */
  time: string | null
  index: number
  order: number
  completedAt: string | null
}

/** Sprint com a rotina da semana. `reminders` (sáb/dom) ficam fora do sprint e não pontuam. */
export interface SprintView {
  sprint: Sprint
  /** `false` enquanto a semana não começou. */
  started: boolean
  preview: boolean
  occurrences: RoutineOccurrence[]
  reminders: RoutineOccurrence[]
}

export interface Scoreboard {
  total: number
  done: number
  /** 0–100 com uma casa. Só para exibir: o selo de bônus usa `bonus`, nunca este valor. */
  percentage: number
  bonus: boolean
  routine: { daysWithRoutine: number; daysCompleted: number; pointsPerDay: number; total: number; done: number }
  tasks: { count: number; completed: number; total: number; done: number }
}

export interface SprintScoreboard {
  sprintId: ID
  startDate: string
  endDate: string
  started: boolean
  preview: boolean
  scoreboard: Scoreboard
}

/** Um dia útil do sprint, já com o que a tela precisa. */
export interface SprintDay {
  /** `YYYY-MM-DD` */
  date: string
  label: string
  short: string
  isToday: boolean
  /** Dia que já passou: só leitura (a conclusão é da issue #144). */
  locked: boolean
}

export const SPRINT_WEEKDAY_LABELS = [
  { label: 'Segunda-feira', short: 'Seg' },
  { label: 'Terça-feira', short: 'Ter' },
  { label: 'Quarta-feira', short: 'Qua' },
  { label: 'Quinta-feira', short: 'Qui' },
  { label: 'Sexta-feira', short: 'Sex' },
] as const

export const SPRINT_WHICH_OPTIONS: readonly { value: SprintWhich; label: string }[] = [
  { value: 'current', label: 'Sprint atual' },
  { value: 'next', label: 'Próximo sprint' },
]
