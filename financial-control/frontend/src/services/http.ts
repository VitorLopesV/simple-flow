import axios, { AxiosError, type AxiosInstance } from 'axios'

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

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status
    const mensagem =
      error.response?.data?.message ??
      (status === 404
        ? 'Registro não encontrado.'
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
