import type { SuperTaskDto } from '@/types/dto'
import type { Task, TaskFilter } from '@/types/task'
import type {
  SuperTask,
  SuperTaskChildrenDestination,
  SuperTaskEdit,
  SuperTaskPayload,
} from '@/types/superTask'
import { SUPER_TASK_REASON } from '@/types/superTask'
import { toISODate } from '@/utils/dateFormatter'
import { http, USE_MOCK } from './http'
import { toSuperTask, toSuperTaskEditDto, toSuperTaskPayloadDto } from './mappers'
import { delay, mockDb } from './mock'
import type { SuperTaskRecord } from './mock/db'

type Db = Awaited<ReturnType<typeof mockDb>>

function findRecord(db: Db, id: string): SuperTaskRecord {
  const record = db.superTasks.find((item) => item.id === id)
  if (!record) throw new Error('Super task não encontrada.')
  return record
}

function findTask(db: Db, id: string): Task {
  const task = db.tasks.find((item) => item.id === id)
  if (!task) throw new Error('Tarefa não encontrada.')
  return task
}

function assertCommonArea(db: Db, areaId: string): void {
  const area = db.areas.find((item) => item.id === areaId)
  if (!area) throw new Error('Área inválida.')
  if (area.system) throw new Error('A área Rotina não aceita Super tasks.')
}

function assertOpen(record: SuperTaskRecord): void {
  if (record.completedAt) throw new Error(SUPER_TASK_REASON.locked)
}

function assertTitle(title: string): void {
  if (!title.trim()) throw new Error('Informe o título da Super task.')
}

/** Como o backend: % = concluídas ÷ total (arredonda para baixo); estado e vencida derivam disso. */
function detail(db: Db, record: SuperTaskRecord): SuperTask {
  const children = db.clone(db.tasks.filter((task) => task.superTaskId === record.id))
  const completed = children.filter((task) => task.done).length
  const done = record.completedAt !== null
  const progress = children.length ? Math.floor((completed * 100) / children.length) : 0
  return {
    id: record.id,
    areaId: record.areaId,
    title: record.title,
    notes: record.notes,
    endDate: record.endDate,
    completedAt: record.completedAt,
    done,
    archived: record.archived,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    tasks: children,
    totalTasks: children.length,
    completedTasks: completed,
    progress,
    state: done ? 'CONCLUIDA' : completed > 0 ? 'EM_ANDAMENTO' : 'NAO_INICIADA',
    overdue: !done && record.endDate !== null && record.endDate < toISODate(new Date()),
    // Reaberta ainda em 100%: o estado volta a "em andamento" e dá para marcar de novo.
    canComplete: !done && children.length > 0 && completed === children.length,
  }
}

/** Mais recentes primeiro, como o backend devolve. */
function newestFirst(a: SuperTask, b: SuperTask): number {
  return b.createdAt.localeCompare(a.createdAt)
}

export const superTaskService = {
  async list(filter: TaskFilter = {}): Promise<SuperTask[]> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(
        db.superTasks
          .filter((record) => (filter.includeArchived ? true : !record.archived))
          .filter((record) => !filter.areaId || record.areaId === filter.areaId)
          .map((record) => detail(db, record))
          .sort(newestFirst),
      )
    }

    const { data } = await http.get<SuperTaskDto[]>('/super-tasks', {
      params: { areaId: filter.areaId, arquivadas: filter.includeArchived ? 'true' : undefined },
    })
    return data.map(toSuperTask)
  },

  async create(payload: SuperTaskPayload): Promise<SuperTask> {
    if (USE_MOCK) {
      const db = await mockDb()
      assertTitle(payload.title)
      assertCommonArea(db, payload.areaId)
      const record: SuperTaskRecord = {
        id: db.newId('sup'),
        areaId: payload.areaId,
        title: payload.title.trim(),
        notes: payload.notes,
        endDate: payload.endDate,
        completedAt: null,
        archived: false,
        archivedAt: null,
        createdAt: db.now(),
      }
      db.superTasks.push(record)
      return delay(detail(db, record))
    }

    const { data } = await http.post<SuperTaskDto>('/super-tasks', toSuperTaskPayloadDto(payload))
    return toSuperTask(data)
  },

  /**
   * Converte a tarefa em Super task: título, área e notas passam adiante e a tarefa original some.
   * Só vale para tarefa fora do sprint, não concluída, não arquivada e que não seja filha.
   */
  async convert(taskId: string, endDate: string | null = null): Promise<SuperTask> {
    if (USE_MOCK) {
      const db = await mockDb()
      const task = findTask(db, taskId)
      if (task.superTaskId) throw new Error(SUPER_TASK_REASON.convertChild)
      if (task.done) throw new Error(SUPER_TASK_REASON.convertDone)
      if (task.sprintId) throw new Error(SUPER_TASK_REASON.convertInSprint)
      if (task.archived) throw new Error('Tarefa arquivada não pode virar Super task.')
      const record: SuperTaskRecord = {
        id: db.newId('sup'),
        areaId: task.areaId,
        title: task.title,
        notes: task.notes,
        endDate,
        completedAt: null,
        archived: false,
        archivedAt: null,
        createdAt: db.now(),
      }
      db.superTasks.push(record)
      db.tasks.splice(db.tasks.indexOf(task), 1)
      return delay(detail(db, record))
    }

    const { data } = await http.post<SuperTaskDto>('/super-tasks/converter', { tarefaId: taskId, dataTermino: endDate })
    return toSuperTask(data)
  },

  async update(id: string, edit: SuperTaskEdit): Promise<SuperTask> {
    if (USE_MOCK) {
      const db = await mockDb()
      const record = findRecord(db, id)
      assertOpen(record)
      assertTitle(edit.title)
      Object.assign(record, { title: edit.title.trim(), notes: edit.notes, endDate: edit.endDate })
      return delay(detail(db, record))
    }

    const { data } = await http.put<SuperTaskDto>(`/super-tasks/${id}`, toSuperTaskEditDto(edit))
    return toSuperTask(data)
  },

  /** Leva as filhas junto; recusado se houver filha concluída ou no sprint (409 no backend). */
  async move(id: string, areaId: string): Promise<SuperTask> {
    if (USE_MOCK) {
      const db = await mockDb()
      const record = findRecord(db, id)
      assertOpen(record)
      assertCommonArea(db, areaId)
      const children = db.tasks.filter((task) => task.superTaskId === id)
      if (children.some((task) => task.done)) throw new Error(SUPER_TASK_REASON.moveWithDone)
      if (children.some((task) => task.sprintId)) throw new Error(SUPER_TASK_REASON.moveWithSprint)
      record.areaId = areaId
      children.forEach((task) => (task.areaId = areaId))
      return delay(detail(db, record))
    }

    const { data } = await http.patch<SuperTaskDto>(`/super-tasks/${id}/area`, { areaId })
    return toSuperTask(data)
  },

  /** Coloca uma tarefa avulsa, aberta e da mesma área como filha. */
  async addTask(id: string, taskId: string): Promise<SuperTask> {
    if (USE_MOCK) {
      const db = await mockDb()
      const record = findRecord(db, id)
      assertOpen(record)
      const task = findTask(db, taskId)
      if (task.superTaskId) throw new Error('A tarefa já é filha de uma Super task.')
      if (task.areaId !== record.areaId) throw new Error('A tarefa precisa ser da mesma área da Super task.')
      if (task.done) throw new Error('Tarefa concluída não pode entrar na Super task.')
      if (task.archived) throw new Error('Tarefa arquivada não pode entrar na Super task.')
      task.superTaskId = id
      return delay(detail(db, record))
    }

    const { data } = await http.post<SuperTaskDto>(`/super-tasks/${id}/tarefas`, { tarefaId: taskId })
    return toSuperTask(data)
  },

  /** Retira a filha (volta a ser avulsa); a concluída não sai. */
  async removeTask(id: string, taskId: string): Promise<SuperTask> {
    if (USE_MOCK) {
      const db = await mockDb()
      const record = findRecord(db, id)
      const task = findTask(db, taskId)
      if (task.superTaskId !== id) throw new Error('A tarefa não pertence a esta Super task.')
      if (task.done) throw new Error(SUPER_TASK_REASON.childDone)
      task.superTaskId = null
      db.syncSuperTaskCompletion(id)
      return delay(detail(db, record))
    }

    const { data } = await http.delete<SuperTaskDto>(`/super-tasks/${id}/tarefas/${taskId}`)
    return toSuperTask(data)
  },

  /** Só com todas as filhas concluídas (senão 422), sem confirmação; idempotente. */
  async complete(id: string): Promise<SuperTask> {
    if (USE_MOCK) {
      const db = await mockDb()
      const record = findRecord(db, id)
      const children = db.tasks.filter((task) => task.superTaskId === id)
      if (!children.length || children.some((task) => !task.done)) {
        throw new Error(SUPER_TASK_REASON.completeIncomplete)
      }
      record.completedAt ??= db.now()
      return delay(detail(db, record))
    }

    const { data } = await http.patch<SuperTaskDto>(`/super-tasks/${id}/concluir`)
    return toSuperTask(data)
  },

  /** Desmarca a conclusão (reabre), sem confirmação; não reconclui sozinha. */
  async reopen(id: string): Promise<SuperTask> {
    if (USE_MOCK) {
      const db = await mockDb()
      const record = findRecord(db, id)
      record.completedAt = null
      return delay(detail(db, record))
    }

    const { data } = await http.delete<SuperTaskDto>(`/super-tasks/${id}/conclusao`)
    return toSuperTask(data)
  },

  /** Recusado (409) com filha no sprint aberto em qualquer modo, e com filha concluída em "excluir". */
  async remove(id: string, children: SuperTaskChildrenDestination = 'release'): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const record = findRecord(db, id)
      const kids = db.tasks.filter((task) => task.superTaskId === id)
      if (kids.some((task) => task.sprintId && !task.done)) throw new Error(SUPER_TASK_REASON.deleteInSprint)
      if (children === 'delete' && kids.some((task) => task.done)) {
        throw new Error(SUPER_TASK_REASON.deleteTogetherDone)
      }
      if (children === 'delete') {
        db.tasks.splice(0, db.tasks.length, ...db.tasks.filter((task) => task.superTaskId !== id))
      } else {
        kids.forEach((task) => (task.superTaskId = null))
      }
      db.superTasks.splice(db.superTasks.indexOf(record), 1)
      return delay(undefined)
    }

    await http.delete(`/super-tasks/${id}`, { params: { filhas: children === 'delete' ? 'excluir' : 'soltar' } })
  },
}
