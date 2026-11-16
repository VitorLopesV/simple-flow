import type { ID } from './common'

// Os valores de `RoutineRepeatMode` são os gravados na API, por isso continuam em português.

export type RoutineRepeatMode = 'DIAS_DA_SEMANA' | 'A_CADA_N_DIAS'

/** Dias marcáveis: 1 = segunda ... 5 = sexta (sábado e domingo não entram). */
export type RoutineWeekday = 1 | 2 | 3 | 4 | 5

export type RoutineRepeat =
  | { mode: 'DIAS_DA_SEMANA'; days: RoutineWeekday[] }
  | {
      mode: 'A_CADA_N_DIAS'
      /** Dias corridos entre uma ocorrência e outra (1 a 365). */
      interval: number
      /** `YYYY-MM-DD` */
      startDate: string
    }

/** Uma vez do dia; a hora (`HH:MM`) é opcional. */
export interface RoutineTime {
  time: string | null
}

/** Item de rotina: missão diária que pertence sempre à área Rotina. */
export interface RoutineItem {
  id: ID
  areaId: ID
  name: string
  repeat: RoutineRepeat
  times: RoutineTime[]
  createdAt: string
}

/** Corpo de criação e de edição (o `PUT` substitui o item inteiro). */
export type RoutinePayload = Pick<RoutineItem, 'name' | 'repeat' | 'times'>

/** Limites do schema do backend (`rotina.schema.ts`). */
export const ROUTINE_MAX_NAME = 120
export const ROUTINE_MAX_TIMES = 12
export const ROUTINE_MAX_INTERVAL = 365

export const ROUTINE_WEEKDAYS: readonly { value: RoutineWeekday; label: string; short: string }[] = [
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
]

export const ROUTINE_REPEAT_MODES: readonly { value: RoutineRepeatMode; label: string }[] = [
  { value: 'DIAS_DA_SEMANA', label: 'Dias da semana' },
  { value: 'A_CADA_N_DIAS', label: 'A cada N dias' },
]
