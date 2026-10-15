import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { toUser } from '@/services/mappers'
import type { User, UserSession } from '@/types/auth'
import type { UserDto } from '@/types/dto'

// Os valores das chaves de token são os já gravados nos navegadores dos usuários:
// mudar deslogaria todo mundo.
const ACCESS_TOKEN_KEY = 'simpleflow.accessToken'
const REFRESH_TOKEN_KEY = 'simpleflow.refreshToken'
const USER_KEY = 'simpleflow.user'
/**
 * Chave antiga do usuário, que guardava os campos em português (formato da API).
 * Só é lida para migrar sessões abertas antes da troca de nomes do frontend.
 */
const LEGACY_USER_KEY = 'simpleflow.usuario'

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function storedUser(): User | null {
  const user = parseJson<User>(localStorage.getItem(USER_KEY))
  if (user) return user

  const legacy = parseJson<UserDto>(localStorage.getItem(LEGACY_USER_KEY))
  if (!legacy) return null

  const migrated = toUser(legacy)
  localStorage.setItem(USER_KEY, JSON.stringify(migrated))
  localStorage.removeItem(LEGACY_USER_KEY)
  return migrated
}

/** Sessão do usuário autenticado, persistida em localStorage para sobreviver a reloads. */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(storedUser())
  const accessToken = ref<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY))
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY))

  const isAuthenticated = computed(() => !!accessToken.value)

  function setSession(session: UserSession): void {
    user.value = session.user
    accessToken.value = session.accessToken
    refreshToken.value = session.refreshToken

    localStorage.setItem(USER_KEY, JSON.stringify(session.user))
    localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken)
  }

  /** Troca só os dados do usuário (perfil editado), mantendo os tokens da sessão. */
  function updateUser(updated: User): void {
    user.value = updated
    localStorage.setItem(USER_KEY, JSON.stringify(updated))
  }

  function clearSession(): void {
    user.value = null
    accessToken.value = null
    refreshToken.value = null

    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(LEGACY_USER_KEY)
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    setSession,
    updateUser,
    clearSession,
  }
})
