import type { LoginPayload, ProfilePayload, RegisterPayload, User, UserSession } from '@/types/auth'
import type { UserDto, UserSessionDto } from '@/types/dto'
import { http, USE_MOCK } from './http'
import { toLoginDto, toProfileDto, toRegisterDto, toUser, toUserSession } from './mappers'
import { delay } from './mock'

/** Sessão fake usada em modo demonstração (sem backend real). */
function mockSession(email: string, name: string | null = null): UserSession {
  return {
    user: { id: 'mock-user', email, name },
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  }
}

export const authService = {
  async login(payload: LoginPayload): Promise<UserSession> {
    if (USE_MOCK) return delay(mockSession(payload.email))

    const { data } = await http.post<UserSessionDto>('/auth/login', toLoginDto(payload))
    return toUserSession(data)
  },

  async register(payload: RegisterPayload): Promise<UserSession> {
    if (USE_MOCK) return delay(mockSession(payload.email, payload.name ?? null))

    const { data } = await http.post<UserSessionDto>('/auth/registro', toRegisterDto(payload))
    return toUserSession(data)
  },

  async refresh(refreshToken: string): Promise<UserSession> {
    if (USE_MOCK) return delay(mockSession('demo@simpleflow.app'))

    const { data } = await http.post<UserSessionDto>('/auth/refresh', { refreshToken })
    return toUserSession(data)
  },

  async me(): Promise<User> {
    if (USE_MOCK) return delay(mockSession('demo@simpleflow.app').user)

    const { data } = await http.get<UserDto>('/auth/me')
    return toUser(data)
  },

  async updateProfile(payload: ProfilePayload): Promise<User> {
    if (USE_MOCK) return delay({ id: 'mock-user', ...payload })

    const { data } = await http.patch<UserDto>('/auth/me', toProfileDto(payload))
    return toUser(data)
  },
}
