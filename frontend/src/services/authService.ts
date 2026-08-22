import type { LoginPayload, RegistroPayload, SessaoUsuario, Usuario } from '@/types/auth'
import { http, USE_MOCK } from './http'
import { delay } from './mock'

/** Sessão fake usada em modo demonstração (sem backend real). */
function sessaoMock(email: string, nome: string | null = null): SessaoUsuario {
  return {
    usuario: { id: 'mock-user', email, nome },
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  }
}

export const authService = {
  async login(payload: LoginPayload): Promise<SessaoUsuario> {
    if (USE_MOCK) return delay(sessaoMock(payload.email))

    const { data } = await http.post<SessaoUsuario>('/auth/login', payload)
    return data
  },

  async registrar(payload: RegistroPayload): Promise<SessaoUsuario> {
    if (USE_MOCK) return delay(sessaoMock(payload.email, payload.nome ?? null))

    const { data } = await http.post<SessaoUsuario>('/auth/registro', payload)
    return data
  },

  async renovar(refreshToken: string): Promise<SessaoUsuario> {
    if (USE_MOCK) return delay(sessaoMock('demo@simpleflow.app'))

    const { data } = await http.post<SessaoUsuario>('/auth/refresh', { refreshToken })
    return data
  },

  async me(): Promise<Usuario> {
    if (USE_MOCK) return delay(sessaoMock('demo@simpleflow.app').usuario)

    const { data } = await http.get<Usuario>('/auth/me')
    return data
  },
}
