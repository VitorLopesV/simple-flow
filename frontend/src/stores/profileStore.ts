import { defineStore } from 'pinia'
import { ref } from 'vue'

import { authService } from '@/services/authService'
import { getErrorMessage } from '@/services/http'
import type { ProfilePayload } from '@/types/auth'
import { useAuthStore } from './authStore'

/**
 * Edição do perfil do usuário logado. Fica fora do `authStore` porque o `http` já importa o
 * `authStore` (para os tokens) e o serviço importa o `http` — chamar o serviço de dentro do
 * `authStore` fecharia um ciclo de importação.
 */
export const useProfileStore = defineStore('profile', () => {
  const authStore = useAuthStore()

  const saving = ref(false)
  const error = ref<string | null>(null)

  async function save(payload: ProfilePayload): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      const updated = await authService.updateProfile(payload)
      authStore.updateUser({ ...authStore.user, ...updated })
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível salvar o perfil.')
      return false
    } finally {
      saving.value = false
    }
  }

  return { saving, error, save }
})
