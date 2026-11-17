import type { ID } from './common'

// Os valores de `TaskDifficulty` e `TaskPriority` são os gravados na API, por isso
// continuam em português.

/** Tempo estimado em minutos: só estes valores são aceitos pela API. */
export type TaskEstimate = 15 | 30 | 60 | 120 | 240
export type TaskDifficulty = 'FACIL' | 'MEDIA' | 'DIFICIL'
export type TaskPriority = 'BAIXA' | 'MEDIA' | 'ALTA'

/**
 * Item do backlog do módulo Organização. Pertence a uma única área comum (nunca à
 * Rotina). Só o título é obrigatório; o resto é exigido para entrar no sprint.
 */
export interface Task {
  id: ID
  areaId: ID
  title: string
  /** `YYYY-MM-DD` */
  day: string | null
  /** `HH:MM` */
  time: string | null
  estimateMinutes: TaskEstimate | null
  difficulty: TaskDifficulty | null
  priority: TaskPriority | null
  notes: string | null
  /** Sprint em que a tarefa está; `null` = só no backlog. */
  sprintId: ID | null
  /** Conclusão é definitiva: a tarefa concluída fica só para leitura. */
  done: boolean
  /** Instante (ISO) da conclusão; `null` enquanto pendente. */
  completedAt: string | null
  /** Concluída fora do prazo: vale 20% dos pontos. O backend só marca depois de concluir. */
  late: boolean
  /** Nome da Super task pai, quando a tarefa é filha de uma. */
  superTaskName?: string | null
  archived: boolean
  archivedAt: string | null
  createdAt: string
}

/** Campos editáveis; a área muda só por `move`, que valida o destino. */
export type TaskEdit = Omit<
  Task,
  'id' | 'areaId' | 'sprintId' | 'done' | 'completedAt' | 'late' | 'superTaskName' | 'archived' | 'archivedAt' | 'createdAt'
>

export type TaskPayload = TaskEdit & Pick<Task, 'areaId'>

export interface TaskFilter {
  areaId?: ID
  /** Arquivadas ficam ocultas por padrão; `true` as inclui. */
  includeArchived?: boolean
}

export const TASK_ESTIMATES: readonly { value: TaskEstimate; label: string }[] = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 h' },
  { value: 120, label: '2 h' },
  { value: 240, label: '4 h' },
]

export const TASK_DIFFICULTIES: readonly { value: TaskDifficulty; label: string }[] = [
  { value: 'FACIL', label: 'Fácil' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'DIFICIL', label: 'Difícil' },
]

export const TASK_PRIORITIES: readonly { value: TaskPriority; label: string }[] = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'ALTA', label: 'Alta' },
]

/** Nomes dos campos que faltam para a tarefa entrar no sprint (a hora é opcional). */
export function missingSprintFields(task: Task): string[] {
  const missing: string[] = []
  if (!task.day) missing.push('dia')
  if (!task.estimateMinutes) missing.push('tempo')
  if (!task.difficulty) missing.push('dificuldade')
  if (!task.priority) missing.push('prioridade')
  return missing
}

export function isSprintReady(task: Task): boolean {
  return missingSprintFields(task).length === 0
}
