import type { ID } from './common'
import type { Task } from './task'

/** Estado derivado das filhas; só a conclusão é gravada pelo backend. */
export type SuperTaskState = 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'CONCLUIDA'

/**
 * Agrupamento de tarefas filhas dentro de uma área, para trabalhos grandes (#65). Não é uma
 * tarefa: nunca entra no sprint nem pontua. Progresso, estado e `overdue` vêm calculados.
 */
export interface SuperTask {
  id: ID
  areaId: ID
  title: string
  notes: string | null
  /** Data de término (`YYYY-MM-DD`), opcional. */
  endDate: string | null
  completedAt: string | null
  /** Concluída trava edição, mudança de área e filhas novas até ser reaberta. */
  done: boolean
  archived: boolean
  archivedAt: string | null
  createdAt: string
  tasks: Task[]
  totalTasks: number
  completedTasks: number
  /** Inteiro de 0 a 100, arredondado para baixo. */
  progress: number
  state: SuperTaskState
  /** Data de término passada sem conclusão: só destaque visual, sem atraso nem pontos. */
  overdue: boolean
  /** 100% das filhas concluídas, mas a Super task está reaberta: pode ser marcada de novo. */
  canComplete: boolean
}

export type SuperTaskEdit = Pick<SuperTask, 'title' | 'notes' | 'endDate'>
export type SuperTaskPayload = SuperTaskEdit & Pick<SuperTask, 'areaId'>

/** O que fazer com as filhas ao excluir a Super task. */
export type SuperTaskChildrenDestination = 'release' | 'delete'

export const SUPER_TASK_STATE_LABEL: Record<SuperTaskState, string> = {
  NAO_INICIADA: 'Não iniciada',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
}

/** Mensagens que explicam por que uma ação está desabilitada (espelham as recusas do backend). */
export const SUPER_TASK_REASON = {
  convertInSprint: 'Tarefa no sprint não pode virar Super task: retire-a do sprint antes.',
  convertDone: 'Tarefa concluída não pode virar Super task.',
  convertChild: 'Tarefa que já é filha de uma Super task não pode virar Super task.',
  locked: 'Super task concluída está travada: reabra para alterar.',
  childDone: 'Tarefa concluída não pode sair da Super task nem mudar de área.',
  childMove: 'Para mudar de área, mova a Super task: as filhas vão junto.',
  moveWithDone: 'Não dá para mover: há filha concluída.',
  moveWithSprint: 'Não dá para mover: há filha no sprint.',
  deleteInSprint: 'Não dá para excluir: há filha no sprint aberto. Retire-a do sprint antes.',
  deleteTogetherDone: 'Não dá para excluir junto: há filha concluída. Solte as filhas.',
  completeIncomplete: 'Só dá para marcar como concluída com 100% das filhas concluídas.',
  completeArchived: 'Há filha arquivada ainda aberta: desarquive ou retire da Super task para concluir.',
} as const
