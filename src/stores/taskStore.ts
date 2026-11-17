import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/services/http'
import { taskService } from '@/services/taskService'
import type { Task, TaskEdit, TaskPayload } from '@/types/task'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  /** Quando `true`, a lista traz também as arquivadas. */
  const showArchived = ref(false)

  const isEmpty = computed(() => !loading.value && tasks.value.length === 0)

  /** Tarefas de uma área, na ordem devolvida pela API (mais recentes primeiro). */
  function byArea(areaId: string): Task[] {
    return tasks.value.filter((task) => task.areaId === areaId)
  }

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      tasks.value = await taskService.list({ includeArchived: showArchived.value })
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível carregar as tarefas.')
      tasks.value = []
    } finally {
      loading.value = false
    }
  }

  async function setShowArchived(value: boolean): Promise<void> {
    showArchived.value = value
    await load()
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

  const create = (payload: TaskPayload) =>
    mutate(() => taskService.create(payload), 'Não foi possível salvar a tarefa.')
  const update = (id: string, edit: TaskEdit) =>
    mutate(() => taskService.update(id, edit), 'Não foi possível atualizar a tarefa.')
  const move = (id: string, areaId: string) =>
    mutate(() => taskService.move(id, areaId), 'Não foi possível mover a tarefa.')
  const archive = (id: string) => mutate(() => taskService.archive(id), 'Não foi possível arquivar a tarefa.')
  const unarchive = (id: string) =>
    mutate(() => taskService.unarchive(id), 'Não foi possível desarquivar a tarefa.')
  /** Conclusão definitiva: não existe desmarcar. */
  const complete = (id: string) => mutate(() => taskService.complete(id), 'Não foi possível concluir a tarefa.')
  const remove = (id: string) => mutate(() => taskService.remove(id), 'Não foi possível excluir a tarefa.')

  return {
    tasks,
    loading,
    saving,
    error,
    showArchived,
    isEmpty,
    byArea,
    load,
    setShowArchived,
    create,
    update,
    move,
    archive,
    unarchive,
    complete,
    remove,
  }
})
