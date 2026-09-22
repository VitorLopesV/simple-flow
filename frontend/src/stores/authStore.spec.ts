import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/stores/authStore'
import type { SessaoUsuario, Usuario } from '@/types/auth'

const CHAVE_ACCESS_TOKEN = 'simpleflow.accessToken'
const CHAVE_REFRESH_TOKEN = 'simpleflow.refreshToken'
const CHAVE_USUARIO = 'simpleflow.usuario'

const usuario: Usuario = { id: 'usr_1', email: 'ana@exemplo.com', nome: 'Ana' }

const sessao: SessaoUsuario = {
  usuario,
  accessToken: 'access-123',
  refreshToken: 'refresh-456',
  expiresIn: 3600,
}

/** Simula um reload: novo Pinia, então o store é recriado e relê o `localStorage`. */
function recriarStore() {
  setActivePinia(createPinia())
  return useAuthStore()
}

function salvarSessaoNoStorage(): void {
  localStorage.setItem(CHAVE_ACCESS_TOKEN, sessao.accessToken)
  localStorage.setItem(CHAVE_REFRESH_TOKEN, sessao.refreshToken)
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario))
}

beforeEach(() => {
  localStorage.clear()
})

describe('sem dados salvos', () => {
  it('começa deslogado', () => {
    const store = recriarStore()

    expect(store.autenticado).toBe(false)
    expect(store.usuario).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
  })
})

describe('hidratação', () => {
  it('lê token e usuário salvos no localStorage ao ser criado', () => {
    salvarSessaoNoStorage()

    const store = recriarStore()

    expect(store.autenticado).toBe(true)
    expect(store.accessToken).toBe('access-123')
    expect(store.refreshToken).toBe('refresh-456')
    expect(store.usuario).toEqual(usuario)
  })

  it('JSON de usuário corrompido resulta em usuario null, sem lançar', () => {
    salvarSessaoNoStorage()
    localStorage.setItem(CHAVE_USUARIO, '{corrompido')

    const store = recriarStore()

    expect(store.usuario).toBeNull()
    expect(store.accessToken).toBe('access-123')
    expect(store.autenticado).toBe(true)
  })

  it('só o token salvo, sem usuário, continua autenticado', () => {
    localStorage.setItem(CHAVE_ACCESS_TOKEN, 'so-token')

    const store = recriarStore()

    expect(store.autenticado).toBe(true)
    expect(store.usuario).toBeNull()
  })

  it('só o usuário salvo, sem token, não autentica', () => {
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario))

    const store = recriarStore()

    expect(store.autenticado).toBe(false)
    expect(store.usuario).toEqual(usuario)
  })
})

describe('definirSessao', () => {
  it('atualiza o estado', () => {
    const store = recriarStore()

    store.definirSessao(sessao)

    expect(store.usuario).toEqual(usuario)
    expect(store.accessToken).toBe('access-123')
    expect(store.refreshToken).toBe('refresh-456')
    expect(store.autenticado).toBe(true)
  })

  it('grava as 3 chaves no localStorage', () => {
    const store = recriarStore()

    store.definirSessao(sessao)

    expect(localStorage.getItem(CHAVE_ACCESS_TOKEN)).toBe('access-123')
    expect(localStorage.getItem(CHAVE_REFRESH_TOKEN)).toBe('refresh-456')
    expect(JSON.parse(localStorage.getItem(CHAVE_USUARIO)!)).toEqual(usuario)
  })

  it('substitui uma sessão anterior', () => {
    const store = recriarStore()
    store.definirSessao(sessao)

    store.definirSessao({
      usuario: { id: 'usr_2', email: 'bia@exemplo.com', nome: null },
      accessToken: 'novo-access',
      refreshToken: 'novo-refresh',
      expiresIn: 60,
    })

    expect(store.usuario?.id).toBe('usr_2')
    expect(store.accessToken).toBe('novo-access')
    expect(localStorage.getItem(CHAVE_ACCESS_TOKEN)).toBe('novo-access')
    expect(localStorage.getItem(CHAVE_REFRESH_TOKEN)).toBe('novo-refresh')
  })

  it('a sessão sobrevive a um reload', () => {
    recriarStore().definirSessao(sessao)

    const recarregado = recriarStore()

    expect(recarregado.autenticado).toBe(true)
    expect(recarregado.usuario).toEqual(usuario)
    expect(recarregado.refreshToken).toBe('refresh-456')
  })
})

describe('limparSessao', () => {
  it('zera o estado', () => {
    const store = recriarStore()
    store.definirSessao(sessao)

    store.limparSessao()

    expect(store.usuario).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.autenticado).toBe(false)
  })

  it('remove as 3 chaves do localStorage e preserva as demais', () => {
    const store = recriarStore()
    store.definirSessao(sessao)
    localStorage.setItem('simpleflow.outra', 'mantida')

    store.limparSessao()

    expect(localStorage.getItem(CHAVE_ACCESS_TOKEN)).toBeNull()
    expect(localStorage.getItem(CHAVE_REFRESH_TOKEN)).toBeNull()
    expect(localStorage.getItem(CHAVE_USUARIO)).toBeNull()
    expect(localStorage.getItem('simpleflow.outra')).toBe('mantida')
  })

  it('após o logout, um reload não restaura a sessão', () => {
    recriarStore().definirSessao(sessao)
    recriarStore().limparSessao()

    const recarregado = recriarStore()

    expect(recarregado.autenticado).toBe(false)
    expect(recarregado.usuario).toBeNull()
  })

  it('não lança quando não há sessão', () => {
    const store = recriarStore()

    expect(() => store.limparSessao()).not.toThrow()
    expect(store.autenticado).toBe(false)
  })
})

describe('autenticado', () => {
  it('reflete a presença do accessToken', () => {
    const store = recriarStore()
    expect(store.autenticado).toBe(false)

    store.definirSessao(sessao)
    expect(store.autenticado).toBe(true)

    store.limparSessao()
    expect(store.autenticado).toBe(false)
  })
})
