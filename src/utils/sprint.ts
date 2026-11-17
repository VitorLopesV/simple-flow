import type { SprintDay } from '@/types/sprint'
import { SPRINT_WEEKDAY_LABELS } from '@/types/sprint'
import type { TaskDifficulty, TaskEstimate, TaskPriority } from '@/types/task'
import { toDate, toISODate } from './dateFormatter'

/** Soma `amount` dias a uma data `YYYY-MM-DD` (ao meio-dia local, sem bug de fuso). */
export function addDays(iso: string, amount: number): string {
  const date = toDate(iso)
  date.setDate(date.getDate() + amount)
  return toISODate(date)
}

/** Segunda-feira da semana de `iso`; sábado e domingo pertencem à semana que acabou. */
export function mondayOf(iso: string): string {
  const weekday = toDate(iso).getDay() // 0 = domingo
  return addDays(iso, -((weekday + 6) % 7))
}

/** Os cinco dias úteis (seg–sex) do sprint, marcando hoje e os que já passaram. */
export function sprintDays(startDate: string, today: string): SprintDay[] {
  return SPRINT_WEEKDAY_LABELS.map((weekday, index) => {
    const date = addDays(startDate, index)
    return { date, label: weekday.label, short: weekday.short, isToday: date === today, locked: date < today }
  })
}

/** Mesma tabela do backend (`CONFIGURACAO_PONTUACAO`), usada só pelo mock. */
const BASE_BY_ESTIMATE: Record<TaskEstimate, number> = { 15: 2, 30: 3, 60: 5, 120: 8, 240: 13 }
const DIFFICULTY_FACTOR: Record<TaskDifficulty, number> = { FACIL: 1, MEDIA: 1.5, DIFICIL: 2 }
const PRIORITY_FACTOR: Record<TaskPriority, number> = { BAIXA: 1, MEDIA: 1.2, ALTA: 1.5 }

/** Pontos de uma tarefa: base(tempo) × dificuldade × prioridade, arredondado. */
export function taskPoints(estimate: TaskEstimate, difficulty: TaskDifficulty, priority: TaskPriority): number {
  return Math.round(BASE_BY_ESTIMATE[estimate] * DIFFICULTY_FACTOR[difficulty] * PRIORITY_FACTOR[priority])
}

/** `90` -> `1 h 30 min`; `0` -> `0 min`. */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours && rest) return `${hours} h ${rest} min`
  if (hours) return `${hours} h`
  return `${rest} min`
}

const SAO_PAULO = 'America/Sao_Paulo'

/** Data de hoje (`YYYY-MM-DD`) em America/Sao_Paulo, e não no fuso do navegador. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  // `en-CA` formata como `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** `true` se, em America/Sao_Paulo, hoje é domingo: dia de planejar o próximo sprint. */
export function isSundayInSaoPaulo(now: Date = new Date()): boolean {
  return toDate(todayInSaoPaulo(now)).getDay() === 0
}
