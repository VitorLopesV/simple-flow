import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

import { useAuthStore } from '@/stores/authStore'

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

type ConfigComRetry = InternalAxiosRequestConfig & { _retry?: boolean }

/** Evita disparar várias renovações de token em paralelo quando várias chamadas recebem 401 juntas. */
let renovacaoEmAndamento: Promise<void> | null = null

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    const config = error.config as ConfigComRetry | undefined
    const status = error.response?.status
    const authStore = useAuthStore()
    const ehRotaDeAuth = config?.url?.startsWith('/auth/')

    if (status === 401 && config && !config._retry && !ehRotaDeAuth && authStore.refreshToken) {
      config._retry = true

      try {
        renovacaoEmAndamento ??= (async () => {
          const { data } = await http.post<{ accessToken: string; refreshToken: string; expiresIn: number; usuario: unknown }>(
            '/auth/refresh',
            { refreshToken: authStore.refreshToken },
          )
          authStore.definirSessao(data as Parameters<typeof authStore.definirSessao>[0])
        })().finally(() => {
          renovacaoEmAndamento = null
        })

        await renovacaoEmAndamento
        config.headers.set('Authorization', `Bearer ${authStore.accessToken}`)
        return await http.request(config)
      } catch {
        authStore.limparSessao()
        window.location.assign('/auth/login')
        return Promise.reject(new ApiError('Sessão expirada. Faça login novamente.', 401))
      }
    }

    const mensagem =
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

    return Promise.reject(new ApiError(mensagem, status))
  },
)

/** Normaliza qualquer erro em uma mensagem exibível. */
export function mensagemDeErro(erro: unknown, padrao = 'Algo deu errado.'): string {
  if (erro instanceof ApiError) return erro.message
  if (erro instanceof Error && erro.message) return erro.message
  return padrao
}
