import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

import { useAuthStore } from '@/stores/authStore'
import type { UserSessionDto } from '@/types/dto'
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
  ) {
    super(message)
    this.name = 'ApiError'
  }
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

    return Promise.reject(new ApiError(message, status))
  },
)

/** Normaliza qualquer erro em uma mensagem exibível. */
export function getErrorMessage(error: unknown, fallback = 'Algo deu errado.'): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
