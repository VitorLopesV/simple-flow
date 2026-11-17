import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/services/http'
import { homeService } from '@/services/homeService'
import { sprintService } from '@/services/sprintService'
import { taskService } from '@/services/taskService'
import type { HomeSummary } from '@/types/home'

/** Resumo da Home (`GET /home/resumo`): o essencial de cada módulo numa carga só. */
export const useHomeStore = defineStore('home', () => {
  const summary = ref<HomeSummary | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  /** Sequência da última carga: ignora respostas antigas. */
  let loadId = 0

  /** Concluídas / total da missão do dia, para a barra de progresso. */
  const missionProgress = computed(() => {
    const mission = summary.value?.mission
    return mission && mission.total ? (mission.completed / mission.total) * 100 : 0
  })

  async function load(): Promise<void> {
    const current = ++loadId
    loading.value = true
    error.value = null
    try {
      const next = await homeService.summary()
      if (current !== loadId) return
      summary.value = next
    } catch (e) {
      if (current !== loadId) return
      error.value = getErrorMessage(e, 'Não foi possível carregar a página inicial.')
    } finally {
      if (current === loadId) loading.value = false
    }
  }

  /** Executa a conclusão, recarrega o resumo (placar e blocos mudam juntos) e devolve se deu certo. */
  async function mutate(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      await action()
    } catch (e) {
      error.value = getErrorMessage(e, fallback)
      saving.value = false
      return false
    }
    saving.value = false
    await load()
    return true
  }

  /** Mesma conclusão (definitiva) da página Sprint/Tarefas, com a confirmação feita pela tela. */
  const completeTask = (taskId: string) =>
    mutate(() => taskService.complete(taskId), 'Não foi possível concluir a tarefa.')
  /** Rotina e lembretes de fim de semana (estes não pontuam) concluem pela mesma rota. */
  const completeOccurrence = (occurrenceId: string) =>
    mutate(() => sprintService.completeOccurrence(occurrenceId), 'Não foi possível concluir a rotina.')

  /** Esquece o resumo ao sair da conta. */
  function reset(): void {
    loadId += 1
    summary.value = null
    loading.value = false
    saving.value = false
    error.value = null
  }

  return { summary, loading, saving, error, missionProgress, load, reset, completeTask, completeOccurrence }
})
