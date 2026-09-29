import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/stores/authStore'
import type { UserSession, User } from '@/types/auth'

const ACCESS_TOKEN_KEY = 'simpleflow.accessToken'
const REFRESH_TOKEN_KEY = 'simpleflow.refreshToken'
const USER_KEY = 'simpleflow.user'
/** Chave antiga, com o usuário no formato da API (campos em português). */
const LEGACY_USER_KEY = 'simpleflow.usuario'

const user: User = { id: 'usr_1', email: 'ana@exemplo.com', name: 'Ana' }

const session: UserSession = {
  user,
  accessToken: 'access-123',
  refreshToken: 'refresh-456',
  expiresIn: 3600,
}

/** Simula um reload: novo Pinia, então o store é recriado e relê o `localStorage`. */
function recreateStore() {
  setActivePinia(createPinia())
  return useAuthStore()
}

function saveSessionToStorage(): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

beforeEach(() => {
  localStorage.clear()
})

describe('sem dados salvos', () => {
  it('começa deslogado', () => {
    const store = recreateStore()

    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
  })
})

describe('hidratação', () => {
  it('migra o usuário salvo na chave antiga, com os campos da API, para o formato novo', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken)
    localStorage.setItem(
      LEGACY_USER_KEY,
      JSON.stringify({ id: 'usr_1', email: 'ana@exemplo.com', nome: 'Ana', telefone: null, fotoUrl: null }),
    )

    const store = recreateStore()

    expect(store.user).toEqual({ ...user, phone: null, photoUrl: null })
    expect(JSON.parse(localStorage.getItem(USER_KEY)!)).toEqual({ ...user, phone: null, photoUrl: null })
    expect(localStorage.getItem(LEGACY_USER_KEY)).toBeNull()
  })

  it('prefere a chave nova quando as duas existem', () => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    localStorage.setItem(LEGACY_USER_KEY, JSON.stringify({ id: 'usr_old', email: 'x@y.com', nome: 'Velho' }))

    expect(recreateStore().user).toEqual(user)
  })

  it('lê token e usuário salvos no localStorage ao ser criado', () => {
    saveSessionToStorage()

    const store = recreateStore()

    expect(store.isAuthenticated).toBe(true)
    expect(store.accessToken).toBe('access-123')
    expect(store.refreshToken).toBe('refresh-456')
    expect(store.user).toEqual(user)
  })

  it('JSON de usuário corrompido resulta em usuario null, sem lançar', () => {
    saveSessionToStorage()
    localStorage.setItem(USER_KEY, '{corrompido')

    const store = recreateStore()

    expect(store.user).toBeNull()
    expect(store.accessToken).toBe('access-123')
    expect(store.isAuthenticated).toBe(true)
  })

  it('só o token salvo, sem usuário, continua autenticado', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'so-token')

    const store = recreateStore()

    expect(store.isAuthenticated).toBe(true)
    expect(store.user).toBeNull()
  })

  it('só o usuário salvo, sem token, não autentica', () => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))

    const store = recreateStore()

    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toEqual(user)
  })
})

describe('setSession', () => {
  it('atualiza o estado', () => {
    const store = recreateStore()

    store.setSession(session)

    expect(store.user).toEqual(user)
    expect(store.accessToken).toBe('access-123')
    expect(store.refreshToken).toBe('refresh-456')
    expect(store.isAuthenticated).toBe(true)
  })

  it('grava as 3 chaves no localStorage', () => {
    const store = recreateStore()

    store.setSession(session)

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('access-123')
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-456')
    expect(JSON.parse(localStorage.getItem(USER_KEY)!)).toEqual(user)
  })

  it('substitui uma sessão anterior', () => {
    const store = recreateStore()
    store.setSession(session)

    store.setSession({
      user: { id: 'usr_2', email: 'bia@exemplo.com', name: null },
      accessToken: 'novo-access',
      refreshToken: 'novo-refresh',
      expiresIn: 60,
    })

    expect(store.user?.id).toBe('usr_2')
    expect(store.accessToken).toBe('novo-access')
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('novo-access')
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('novo-refresh')
  })

  it('a sessão sobrevive a um reload', () => {
    recreateStore().setSession(session)

    const reloaded = recreateStore()

    expect(reloaded.isAuthenticated).toBe(true)
    expect(reloaded.user).toEqual(user)
    expect(reloaded.refreshToken).toBe('refresh-456')
  })
})

describe('clearSession', () => {
  it('zera o estado', () => {
    const store = recreateStore()
    store.setSession(session)

    store.clearSession()

    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('remove as 3 chaves do localStorage e preserva as demais', () => {
    const store = recreateStore()
    store.setSession(session)
    localStorage.setItem('simpleflow.outra', 'mantida')

    store.clearSession()

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(USER_KEY)).toBeNull()
    expect(localStorage.getItem('simpleflow.outra')).toBe('mantida')
  })

  it('também remove a chave antiga do usuário, se ainda existir', () => {
    const store = recreateStore()
    store.setSession(session)
    localStorage.setItem(LEGACY_USER_KEY, JSON.stringify({ id: 'usr_1', email: 'ana@exemplo.com', nome: 'Ana' }))

    store.clearSession()

    expect(localStorage.getItem(LEGACY_USER_KEY)).toBeNull()
  })

  it('após o logout, um reload não restaura a sessão', () => {
    recreateStore().setSession(session)
    recreateStore().clearSession()

    const reloaded = recreateStore()

    expect(reloaded.isAuthenticated).toBe(false)
    expect(reloaded.user).toBeNull()
  })

  it('não lança quando não há sessão', () => {
    const store = recreateStore()

    expect(() => store.clearSession()).not.toThrow()
    expect(store.isAuthenticated).toBe(false)
  })
})

describe('isAuthenticated', () => {
  it('reflete a presença do accessToken', () => {
    const store = recreateStore()
    expect(store.isAuthenticated).toBe(false)

    store.setSession(session)
    expect(store.isAuthenticated).toBe(true)

    store.clearSession()
    expect(store.isAuthenticated).toBe(false)
  })
})

describe('updateUser', () => {
  it('troca os dados do usuário, persiste e mantém os tokens', () => {
    const store = recreateStore()
    store.setSession(session)

    store.updateUser({ ...user, name: 'Ana Souza', phone: '11999998888', photoUrl: 'data:x' })

    expect(store.user?.name).toBe('Ana Souza')
    expect(store.accessToken).toBe('access-123')
    expect(JSON.parse(localStorage.getItem(USER_KEY)!)).toMatchObject({
      name: 'Ana Souza',
      phone: '11999998888',
      photoUrl: 'data:x',
    })
    expect(recreateStore().user?.name).toBe('Ana Souza')
  })
})
