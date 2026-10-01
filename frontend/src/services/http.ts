import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

import { useAuthStore } from '@/stores/authStore'
import type { EditedMonthsConflictDto, UserSessionDto } from '@/types/dto'
import { toUserSession } from './mappers'

/** Liga a camada de mock quando não há backend disponível. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

/** Latência artificial do mock, em ms. */
export const MOCK_LATENCY = Number(import.meta.env.VITE_MOCK_LATENCY ?? 350)

export const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

/** Erro de aplicação já com mensagem pronta para exibir em toast. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Corpo da resposta de erro, para quem precisa de mais que a mensagem. */
    readonly data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Excluir um mês de uma série recorrente (ou desligar a recorrência) remove os meses
 * seguintes. Se algum deles foi alterado pelo usuário, a API recusa com 409 e lista os
 * meses (`YYYY-MM`) — a operação só acontece se repetida com confirmação explícita.
 */
export class EditedMonthsError extends ApiError {
  constructor(
    readonly months: string[],
    message = 'Há meses seguintes desta série que foram alterados.',
  ) {
    super(message, 409)
    this.name = 'EditedMonthsError'
  }
}

/** Converte o 409 com `mesesAlterados` em `EditedMonthsError`; outros erros passam iguais. */
export function asEditedMonthsError(error: unknown): unknown {
  if (!(error instanceof ApiError) || error.status !== 409) return error
  const months = (error.data as Partial<EditedMonthsConflictDto> | undefined)?.mesesAlterados
  return Array.isArray(months) ? new EditedMonthsError(months.map(String), error.message) : error
}

http.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore()
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

/** Evita disparar várias renovações de token em paralelo quando várias chamadas recebem 401 juntas. */
let refreshInProgress: Promise<void> | null = null

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    const config = error.config as RetryableConfig | undefined
    const status = error.response?.status
    const authStore = useAuthStore()
    const isAuthRoute = config?.url?.startsWith('/auth/')

    if (status === 401 && config && !config._retry && !isAuthRoute && authStore.refreshToken) {
      config._retry = true

      try {
        refreshInProgress ??= (async () => {
          const { data } = await http.post<UserSessionDto>('/auth/refresh', {
            refreshToken: authStore.refreshToken,
          })
          authStore.setSession(toUserSession(data))
        })().finally(() => {
          refreshInProgress = null
        })

        await refreshInProgress
        config.headers.set('Authorization', `Bearer ${authStore.accessToken}`)
        return await http.request(config)
      } catch {
        authStore.clearSession()
        window.location.assign('/auth/login')
        return Promise.reject(new ApiError('Sessão expirada. Faça login novamente.', 401))
      }
    }

    const message =
      error.response?.data?.message ??
      (status === 404
        ? 'Registro não encontrado.'
        : status === 401
          ? 'Sessão expirada. Faça login novamente.'
          : status === 422 || status === 400
            ? 'Dados inválidos. Revise o formulário.'
            : status && status >= 500
              ? 'O servidor não conseguiu processar a solicitação.'
              : error.code === 'ECONNABORTED'
                ? 'A solicitação demorou demais e foi cancelada.'
                : 'Não foi possível conectar ao servidor.')

    return Promise.reject(new ApiError(message, status, error.response?.data))
  },
)

/** Normaliza qualquer erro em uma mensagem exibível. */
export function getErrorMessage(error: unknown, fallback = 'Algo deu errado.'): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
