import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/services/http'
import { routineService } from '@/services/routineService'
import type { RoutineItem, RoutinePayload } from '@/types/routine'

export const useRoutineStore = defineStore('routine', () => {
  const items = ref<RoutineItem[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const isEmpty = computed(() => !loading.value && items.value.length === 0)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      items.value = await routineService.list()
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível carregar a rotina.')
      items.value = []
    } finally {
      loading.value = false
    }
  }

  /** Executa a mutação, recarrega a lista e devolve se deu certo. */
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

  const create = (payload: RoutinePayload) =>
    mutate(() => routineService.create(payload), 'Não foi possível salvar o item.')
  const update = (id: string, payload: RoutinePayload) =>
    mutate(() => routineService.update(id, payload), 'Não foi possível atualizar o item.')
  const remove = (id: string) => mutate(() => routineService.remove(id), 'Não foi possível excluir o item.')

  return { items, loading, saving, error, isEmpty, load, create, update, remove }
})
