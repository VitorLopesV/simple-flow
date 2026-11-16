import type { TaskDto } from '@/types/dto'
import type { Task, TaskEdit, TaskFilter, TaskPayload } from '@/types/task'
import { http, USE_MOCK } from './http'
import { toTask, toTaskEditDto, toTaskPayloadDto } from './mappers'
import { delay, mockDb } from './mock'

type Db = Awaited<ReturnType<typeof mockDb>>

/** Mais recentes primeiro, como o backend devolve. */
function newestFirst(a: Task, b: Task): number {
  return b.createdAt.localeCompare(a.createdAt)
}

function findTask(db: Db, id: string): Task {
  const task = db.tasks.find((item) => item.id === id)
  if (!task) throw new Error('Tarefa não encontrada.')
  return task
}

/** O backend nunca aceita a Rotina (área do sistema) como dona de tarefas. */
function assertCommonArea(db: Db, areaId: string): void {
  const area = db.areas.find((item) => item.id === areaId)
  if (!area) throw new Error('Área inválida.')
  if (area.system) throw new Error('A área Rotina não aceita tarefas.')
}

function assertTitle(title: string): void {
  if (!title.trim()) throw new Error('Informe o título da tarefa.')
}

export const taskService = {
  /** Arquivadas ficam ocultas a menos que `includeArchived` seja `true`. */
  async list(filter: TaskFilter = {}): Promise<Task[]> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(
        db
          .clone(db.tasks)
          .filter((task) => (filter.includeArchived ? true : !task.archived))
          .filter((task) => !filter.areaId || task.areaId === filter.areaId)
          .sort(newestFirst),
      )
    }

    const { data } = await http.get<TaskDto[]>('/tarefas', {
      params: {
        areaId: filter.areaId,
        arquivadas: filter.includeArchived ? 'true' : undefined,
      },
    })
    return data.map(toTask)
  },

  async create(payload: TaskPayload): Promise<Task> {
    if (USE_MOCK) {
      const db = await mockDb()
      assertTitle(payload.title)
      assertCommonArea(db, payload.areaId)
      const task: Task = {
        ...payload,
        title: payload.title.trim(),
        id: db.newId('tar'),
        archived: false,
        archivedAt: null,
        createdAt: db.now(),
      }
      db.tasks.push(task)
      return delay(db.clone(task))
    }

    const { data } = await http.post<TaskDto>('/tarefas', toTaskPayloadDto(payload))
    return toTask(data)
  },

  /** Substitui todos os campos editáveis; a área muda só por `move`. */
  async update(id: string, edit: TaskEdit): Promise<Task> {
    if (USE_MOCK) {
      const db = await mockDb()
      const task = findTask(db, id)
      assertTitle(edit.title)
      Object.assign(task, edit, { title: edit.title.trim() })
      return delay(db.clone(task))
    }

    const { data } = await http.put<TaskDto>(`/tarefas/${id}`, toTaskEditDto(edit))
    return toTask(data)
  },

  async move(id: string, areaId: string): Promise<Task> {
    if (USE_MOCK) {
      const db = await mockDb()
      const task = findTask(db, id)
      assertCommonArea(db, areaId)
      task.areaId = areaId
      return delay(db.clone(task))
    }

    const { data } = await http.patch<TaskDto>(`/tarefas/${id}/area`, { areaId })
    return toTask(data)
  },

  async archive(id: string): Promise<Task> {
    if (USE_MOCK) {
      const db = await mockDb()
      const task = findTask(db, id)
      task.archived = true
      task.archivedAt = db.now()
      return delay(db.clone(task))
    }

    const { data } = await http.patch<TaskDto>(`/tarefas/${id}/arquivar`)
    return toTask(data)
  },

  async unarchive(id: string): Promise<Task> {
    if (USE_MOCK) {
      const db = await mockDb()
      const task = findTask(db, id)
      task.archived = false
      task.archivedAt = null
      return delay(db.clone(task))
    }

    const { data } = await http.patch<TaskDto>(`/tarefas/${id}/desarquivar`)
    return toTask(data)
  },

  async remove(id: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      db.tasks.splice(db.tasks.indexOf(findTask(db, id)), 1)
      return delay(undefined)
    }

    await http.delete(`/tarefas/${id}`)
  },
}
