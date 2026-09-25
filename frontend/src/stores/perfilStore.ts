import { defineStore } from 'pinia'
import { ref } from 'vue'

import { authService } from '@/services/authService'
import { mensagemDeErro } from '@/services/http'
import type { PerfilPayload } from '@/types/auth'
import { useAuthStore } from './authStore'

/**
 * Edição do perfil do usuário logado. Fica fora do `authStore` porque o `http` já importa o
 * `authStore` (para os tokens) e o serviço importa o `http` — chamar o serviço de dentro do
 * `authStore` fecharia um ciclo de importação.
 */
export const usePerfilStore = defineStore('perfil', () => {
  const authStore = useAuthStore()

  const salvando = ref(false)
  const erro = ref<string | null>(null)

  async function salvar(payload: PerfilPayload): Promise<boolean> {
    salvando.value = true
    erro.value = null
    try {
      const atualizado = await authService.atualizarPerfil(payload)
      authStore.atualizarUsuario({ ...authStore.usuario, ...atualizado })
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível salvar o perfil.')
      return false
    } finally {
      salvando.value = false
    }
  }

  return { salvando, erro, salvar }
})
