import type { Task } from '@/types/task'
import { toISODate } from './dateFormatter'
import { taskPoints } from './sprint'

/** Fração dos pontos que uma tarefa concluída com atraso vale (mesma do backend). */
export const LATE_FACTOR = 0.2

/** Hora local `YYYY-MM-DDTHH:MM` de `date`, para comparar com o prazo como texto. */
function toLocalDateTime(date: Date): string {
  return `${toISODate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function addMinutes(dateTime: string, minutes: number): string {
  const [day, time] = dateTime.split('T')
  const [hours, mins] = time.split(':').map(Number)
  const date = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), hours, mins + minutes)
  return toLocalDateTime(date)
}

/**
 * Se concluir em `at` conta como atraso, como `tarefaAtrasada` do backend: com hora, depois de
 * início + tempo estimado (exatamente no limite não atrasa); sem hora, depois do dia da tarefa.
 * Sem dia não há prazo. O backend só marca `late` depois de concluir; antes disso a tela usa isto
 * para avisar que, concluindo agora, os pontos caem para 20%.
 */
export function wouldBeLate(task: Pick<Task, 'day' | 'time' | 'estimateMinutes'>, at: Date = new Date()): boolean {
  if (!task.day) return false
  const local = toLocalDateTime(at)
  if (!task.time) return local.slice(0, 10) > task.day
  return local > addMinutes(`${task.day}T${task.time.slice(0, 5)}`, task.estimateMinutes ?? 0)
}

/** Pontos cheios da tarefa, ou `null` se ela ainda não tem tempo, dificuldade e prioridade. */
export function fullPoints(task: Pick<Task, 'estimateMinutes' | 'difficulty' | 'priority'>): number | null {
  if (!task.estimateMinutes || !task.difficulty || !task.priority) return null
  return taskPoints(task.estimateMinutes, task.difficulty, task.priority)
}

/** Pontos de uma tarefa atrasada: 20% do cheio, arredondado (como o backend). */
export function latePoints(task: Pick<Task, 'estimateMinutes' | 'difficulty' | 'priority'>): number | null {
  const full = fullPoints(task)
  return full === null ? null : Math.round(full * LATE_FACTOR)
}

export type TaskDeadlineState = 'done' | 'done-late' | 'overdue' | 'on-time'

/** Estado de prazo mostrado na UI: antes de concluir (`overdue`) e depois (`done-late`). */
export function deadlineState(task: Task, at: Date = new Date()): TaskDeadlineState {
  if (task.done) return task.late ? 'done-late' : 'done'
  return wouldBeLate(task, at) ? 'overdue' : 'on-time'
}
