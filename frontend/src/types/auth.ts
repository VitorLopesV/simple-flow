import type { ID } from './common'

export interface Usuario {
  id: ID
  email: string
  nome: string | null
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
