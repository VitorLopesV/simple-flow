import type { ID } from './common'

export interface User {
  id: ID
  email: string
  name: string | null
  /** Só dígitos ou já formatado, ex.: `(11) 99999-9999`. */
  phone?: string | null
  /** Foto em data URL (JPEG reduzido no cliente); `null`/ausente = sem foto. */
  photoUrl?: string | null
}

export interface UserSession {
  user: User
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  name?: string
}

/** Dados editáveis no perfil. `photoUrl: null` remove a foto atual. */
export interface ProfilePayload {
  name: string
  email: string
  phone: string | null
  photoUrl: string | null
}
