import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { areaService } from '@/services/areaService'
import { getErrorMessage } from '@/services/http'
import type { Area, AreaPayload, AreaTasksDestination } from '@/types/area'

export const useAreaStore = defineStore('area', () => {
  const areas = ref<Area[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  /** Áreas que o usuário criou (a Rotina, do sistema, fica de fora). */
  const customAreas = computed(() => areas.value.filter((area) => !area.system))
  const isEmpty = computed(() => !loading.value && customAreas.value.length === 0)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      areas.value = await areaService.list()
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível carregar as áreas.')
      areas.value = []
    } finally {
      loading.value = false
    }
  }

  async function create(payload: AreaPayload): Promise<boolean> {
    saving.value = true
    try {
      await areaService.create(payload)
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível salvar a área.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function update(id: string, payload: AreaPayload): Promise<boolean> {
    saving.value = true
    try {
      await areaService.update(id, payload)
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível atualizar a área.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function remove(id: string, destination?: AreaTasksDestination): Promise<boolean> {
    saving.value = true
    try {
      await areaService.remove(id, destination)
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível excluir a área.')
      return false
    } finally {
      saving.value = false
    }
  }

  return { areas, loading, saving, error, customAreas, isEmpty, load, create, update, remove }
})
