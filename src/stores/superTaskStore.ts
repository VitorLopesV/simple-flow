import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/services/http'
import { superTaskService } from '@/services/superTaskService'
import { taskService } from '@/services/taskService'
import type {
  SuperTask,
  SuperTaskChildrenDestination,
  SuperTaskEdit,
  SuperTaskPayload,
} from '@/types/superTask'
import type { TaskPayload } from '@/types/task'

export const useSuperTaskStore = defineStore('superTask', () => {
  const superTasks = ref<SuperTask[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  /** Nome da Super task por id, para a etiqueta nas filhas (ex.: no Sprint). */
  const namesById = computed<Record<string, string>>(() =>
    Object.fromEntries(superTasks.value.map((item) => [item.id, item.title])),
  )

  function byArea(areaId: string): SuperTask[] {
    return superTasks.value.filter((item) => item.areaId === areaId)
  }

  /** Lista também as arquivadas: a filha arquivada ainda conta no progresso e precisa aparecer. */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      superTasks.value = await superTaskService.list({ includeArchived: true })
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível carregar as Super tasks.')
      superTasks.value = []
    } finally {
      loading.value = false
    }
  }

  /** Executa a mutação, recarrega a lista e devolve se deu certo. */
  async function mutate(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
    saving.value = true
    try {
      await action()
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, fallback)
      return false
    } finally {
      saving.value = false
    }
  }

  const create = (payload: SuperTaskPayload) =>
    mutate(() => superTaskService.create(payload), 'Não foi possível criar a Super task.')
  const convert = (taskId: string, endDate: string | null) =>
    mutate(() => superTaskService.convert(taskId, endDate), 'Não foi possível converter a tarefa em Super task.')
  const update = (id: string, edit: SuperTaskEdit) =>
    mutate(() => superTaskService.update(id, edit), 'Não foi possível atualizar a Super task.')
  const move = (id: string, areaId: string) =>
    mutate(() => superTaskService.move(id, areaId), 'Não foi possível mover a Super task.')
  const addTask = (id: string, taskId: string) =>
    mutate(() => superTaskService.addTask(id, taskId), 'Não foi possível colocar a tarefa na Super task.')
  const removeTask = (id: string, taskId: string) =>
    mutate(() => superTaskService.removeTask(id, taskId), 'Não foi possível retirar a tarefa da Super task.')
  /** Sem confirmação: marcar como concluída só vale em 100%. */
  const complete = (id: string) =>
    mutate(() => superTaskService.complete(id), 'Não foi possível concluir a Super task.')
  /** Sem confirmação: desmarcar reabre a Super task. */
  const reopen = (id: string) => mutate(() => superTaskService.reopen(id), 'Não foi possível reabrir a Super task.')
  const remove = (id: string, children: SuperTaskChildrenDestination) =>
    mutate(() => superTaskService.remove(id, children), 'Não foi possível excluir a Super task.')

  /** Cria a tarefa e a coloca na Super task; se não couber, desfaz a criação para não deixar órfã. */
  async function createChild(superTaskId: string, payload: TaskPayload): Promise<boolean> {
    saving.value = true
    try {
      const task = await taskService.create(payload)
      try {
        await superTaskService.addTask(superTaskId, task.id)
      } catch (e) {
        await taskService.remove(task.id).catch(() => undefined)
        throw e
      }
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível criar a tarefa na Super task.')
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    superTasks,
    loading,
    saving,
    error,
    namesById,
    byArea,
    load,
    create,
    convert,
    update,
    move,
    addTask,
    removeTask,
    complete,
    reopen,
    remove,
    createChild,
  }
})
