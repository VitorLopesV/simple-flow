import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/services/http'
import { sprintService } from '@/services/sprintService'
import type { RoutineOccurrence, SprintDay, SprintScoreboard, SprintView, SprintWhich } from '@/types/sprint'
import type { Task } from '@/types/task'
import { toISODate } from '@/utils/dateFormatter'
import { sprintDays } from '@/utils/sprint'

/** Coluna de um dia útil: missão (rotina) e tarefas por hora, com a soma do tempo estimado. */
export interface SprintColumn extends SprintDay {
  occurrences: RoutineOccurrence[]
  tasks: Task[]
  totalMinutes: number
}

/** Tarefas sem hora vêm antes das com hora, e estas por horário. */
function byTime(a: Task, b: Task): number {
  return (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'pt-BR')
}

export const useSprintStore = defineStore('sprint', () => {
  const which = ref<SprintWhich>('current')
  const view = ref<SprintView | null>(null)
  const scoreboard = ref<SprintScoreboard | null>(null)
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  /** Sequência da última carga: ignora respostas antigas se o usuário alternar rápido. */
  let loadId = 0

  const columns = computed<SprintColumn[]>(() => {
    if (!view.value) return []
    const days = sprintDays(view.value.sprint.startDate, toISODate(new Date()))
    return days.map((day) => {
      const dayTasks = tasks.value.filter((task) => task.day === day.date).sort(byTime)
      return {
        ...day,
        occurrences: view.value!.occurrences.filter((entry) => entry.date === day.date),
        tasks: dayTasks,
        totalMinutes: dayTasks.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0),
      }
    })
  })

  /** Dias que ainda aceitam tarefas (hoje e futuros): destino de adicionar e mover. */
  const openDays = computed(() => columns.value.filter((column) => !column.locked))
  const isPreview = computed(() => view.value?.preview ?? false)

  async function load(): Promise<void> {
    const current = ++loadId
    loading.value = true
    error.value = null
    try {
      const [nextView, nextScoreboard] = await Promise.all([
        sprintService.get(which.value),
        sprintService.getScoreboard(which.value),
      ])
      const nextTasks = await sprintService.listTasks(nextView.sprint.id)
      if (current !== loadId) return
      view.value = nextView
      scoreboard.value = nextScoreboard
      tasks.value = nextTasks
    } catch (e) {
      if (current !== loadId) return
      error.value = getErrorMessage(e, 'Não foi possível carregar o sprint.')
      view.value = null
      scoreboard.value = null
      tasks.value = []
    } finally {
      if (current === loadId) loading.value = false
    }
  }

  async function select(value: SprintWhich): Promise<void> {
    which.value = value
    await load()
  }

  /** Executa a mutação, recarrega o sprint e devolve se deu certo. */
  async function mutate(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
    saving.value = true
    error.value = null
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

  const addTask = (taskId: string, day: string) =>
    mutate(() => sprintService.addTask(taskId, day), 'Não foi possível adicionar a tarefa ao sprint.')
  const moveTask = (taskId: string, day: string) =>
    mutate(() => sprintService.moveTask(taskId, day), 'Não foi possível mover a tarefa.')
  const removeTask = (taskId: string) =>
    mutate(() => sprintService.removeTask(taskId), 'Não foi possível remover a tarefa do sprint.')

  return {
    which,
    view,
    scoreboard,
    tasks,
    loading,
    saving,
    error,
    columns,
    openDays,
    isPreview,
    load,
    select,
    addTask,
    moveTask,
    removeTask,
  }
})
