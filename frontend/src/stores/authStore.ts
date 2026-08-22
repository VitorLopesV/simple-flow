import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { SessaoUsuario, Usuario } from '@/types/auth'

const CHAVE_ACCESS_TOKEN = 'simpleflow.accessToken'
const CHAVE_REFRESH_TOKEN = 'simpleflow.refreshToken'
const CHAVE_USUARIO = 'simpleflow.usuario'

function usuarioSalvo(): Usuario | null {
  const bruto = localStorage.getItem(CHAVE_USUARIO)
  if (!bruto) return null
  try {
    return JSON.parse(bruto) as Usuario
  } catch {
    return null
  }
}

/** Sessão do usuário autenticado, persistida em localStorage para sobreviver a reloads. */
export const useAuthStore = defineStore('auth', () => {
  const usuario = ref<Usuario | null>(usuarioSalvo())
  const accessToken = ref<string | null>(localStorage.getItem(CHAVE_ACCESS_TOKEN))
  const refreshToken = ref<string | null>(localStorage.getItem(CHAVE_REFRESH_TOKEN))

  const autenticado = computed(() => !!accessToken.value)

  function definirSessao(sessao: SessaoUsuario): void {
    usuario.value = sessao.usuario
    accessToken.value = sessao.accessToken
    refreshToken.value = sessao.refreshToken

    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(sessao.usuario))
    localStorage.setItem(CHAVE_ACCESS_TOKEN, sessao.accessToken)
    localStorage.setItem(CHAVE_REFRESH_TOKEN, sessao.refreshToken)
  }

  function limparSessao(): void {
    usuario.value = null
    accessToken.value = null
    refreshToken.value = null

    localStorage.removeItem(CHAVE_USUARIO)
    localStorage.removeItem(CHAVE_ACCESS_TOKEN)
    localStorage.removeItem(CHAVE_REFRESH_TOKEN)
  }

  return { usuario, accessToken, refreshToken, autenticado, definirSessao, limparSessao }
})
