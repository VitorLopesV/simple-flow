import type { ID } from './common'

export interface Usuario {
  id: ID
  email: string
  nome: string | null
  /** Só dígitos ou já formatado, ex.: `(11) 99999-9999`. */
  telefone?: string | null
  /** Foto em data URL (JPEG reduzido no cliente); `null`/ausente = sem foto. */
  fotoUrl?: string | null
}

export interface SessaoUsuario {
  usuario: Usuario
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginPayload {
  email: string
  senha: string
}

export interface RegistroPayload {
  email: string
  senha: string
  nome?: string
}

/** Dados editáveis no perfil. `fotoUrl: null` remove a foto atual. */
export interface PerfilPayload {
  nome: string
  email: string
  telefone: string | null
  fotoUrl: string | null
}
