import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/services/http'
import { sprintService } from '@/services/sprintService'
import type { SprintHistoryEntry } from '@/types/sprint'

export const HISTORY_PAGE_SIZE = 10

export const useSprintHistoryStore = defineStore('sprintHistory', () => {
  const items = ref<SprintHistoryEntry[]>([])
  const page = ref(1)
  const pageSize = ref(HISTORY_PAGE_SIZE)
  const total = ref(0)
  /** A API devolve 0 quando não há nenhum sprint fechado. */
  const totalPages = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** `false` até a primeira resposta: separa "ainda não carregou" de "não há sprints fechados". */
  const loaded = ref(false)
  /** Sequência da última carga: ignora respostas antigas se o usuário trocar de página rápido. */
  let loadId = 0

  const isEmpty = computed(() => loaded.value && !error.value && total.value === 0)

  /**
   * Carrega a página `target`. Página fora do intervalo (a API pode recusar ou devolver vazio)
   * não quebra a tela: volta uma vez para a última página existente, ou para a primeira.
   */
  async function load(target = page.value, retry = true): Promise<void> {
    const current = ++loadId
    loading.value = true
    error.value = null
    try {
      const result = await sprintService.listHistory({ page: Math.max(1, target), pageSize: pageSize.value })
      if (current !== loadId) return
      if (retry && result.items.length === 0 && result.total > 0 && result.totalPages > 0) {
        await load(result.totalPages, false)
        return
      }
      items.value = result.items
      page.value = result.page
      total.value = result.total
      totalPages.value = result.totalPages
      loaded.value = true
    } catch (e) {
      if (current !== loadId) return
      if (retry && target > 1) {
        await load(1, false)
        return
      }
      error.value = getErrorMessage(e, 'Não foi possível carregar o histórico de sprints.')
      items.value = []
    } finally {
      if (current === loadId) loading.value = false
    }
  }

  const goTo = (target: number) => load(target)

  return { items, page, pageSize, total, totalPages, loading, error, loaded, isEmpty, load, goTo }
})
