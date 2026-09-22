import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { ApiError, http, mensagemDeErro } from '@/services/http'
import { useAuthStore } from '@/stores/authStore'
import type { SessaoUsuario } from '@/types/auth'

interface Chamada {
  url: string | undefined
  authorization: string | undefined
  corpo: unknown
}

type Roteiro = (config: InternalAxiosRequestConfig, chamada: Chamada) => Promise<AxiosResponse>

const adapterOriginal = http.defaults.adapter

let chamadas: Chamada[] = []
let roteiro: Roteiro

function resposta(config: InternalAxiosRequestConfig, status: number, data: unknown = {}): AxiosResponse {
  return { data, status, statusText: String(status), headers: {}, config }
}

/** Resolve para 2xx e rejeita com `AxiosError` para o resto, como o adapter real. */
function responder(config: InternalAxiosRequestConfig, status: number, data: unknown = {}): Promise<AxiosResponse> {
  const res = resposta(config, status, data)
  if (status >= 200 && status < 300) return Promise.resolve(res)
  return Promise.reject(new AxiosError(`Request failed ${status}`, 'ERR_BAD_REQUEST', config, null, res))
}

function sessao(accessToken: string, refreshToken: string): SessaoUsuario {
  return {
    usuario: { id: 'usr_1', email: 'a@b.com', nome: 'Ana' },
    accessToken,
    refreshToken,
    expiresIn: 3600,
  }
}

function urlsChamadas(): (string | undefined)[] {
  return chamadas.map((chamada) => chamada.url)
}

function chamadasA(url: string): Chamada[] {
  return chamadas.filter((chamada) => chamada.url === url)
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let assign: Mock<(url: string | URL) => void>

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  chamadas = []
  roteiro = (config) => responder(config, 200, { ok: true })

  const adapter: AxiosAdapter = (config) => {
    const chamada: Chamada = {
      url: config.url,
      authorization: config.headers.get('Authorization') as string | undefined,
      corpo: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
    }
    chamadas.push(chamada)
    return roteiro(config, chamada)
  }
  http.defaults.adapter = adapter

  assign = vi.fn<(url: string | URL) => void>()
  vi.spyOn(window.location, 'assign').mockImplementation(assign)
})

afterEach(() => {
  http.defaults.adapter = adapterOriginal
  vi.restoreAllMocks()
})

describe('mensagemDeErro', () => {
  it('usa a mensagem de ApiError', () => {
    expect(mensagemDeErro(new ApiError('Falhou aqui', 500))).toBe('Falhou aqui')
  })

  it('usa a mensagem de Error comum', () => {
    expect(mensagemDeErro(new Error('erro comum'))).toBe('erro comum')
  })

  it('cai no padrão para valores que não são erro', () => {
    expect(mensagemDeErro('texto')).toBe('Algo deu errado.')
    expect(mensagemDeErro(undefined)).toBe('Algo deu errado.')
    expect(mensagemDeErro(undefined, 'Padrão customizado')).toBe('Padrão customizado')
  })

  it('cai no padrão para Error sem mensagem', () => {
    expect(mensagemDeErro(new Error(''), 'Vazio')).toBe('Vazio')
  })
})

describe('interceptor de request', () => {
  it('envia Authorization Bearer quando há accessToken', async () => {
    useAuthStore().definirSessao(sessao('abc', 'ref'))

    await http.get('/entradas')

    expect(chamadas[0]?.authorization).toBe('Bearer abc')
  })

  it('não envia o header sem token', async () => {
    await http.get('/entradas')

    expect(chamadas[0]?.authorization).toBeUndefined()
  })
})

describe('normalização de erro', () => {
  it.each([
    [404, 'Registro não encontrado.'],
    [400, 'Dados inválidos. Revise o formulário.'],
    [422, 'Dados inválidos. Revise o formulário.'],
    [500, 'O servidor não conseguiu processar a solicitação.'],
    [503, 'O servidor não conseguiu processar a solicitação.'],
  ])('status %i vira "%s"', async (status, mensagem) => {
    roteiro = (config) => responder(config, status)

    const erro = await http.get('/x').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).message).toBe(mensagem)
    expect((erro as ApiError).status).toBe(status)
  })

  it('401 sem refresh possível vira mensagem de sessão expirada', async () => {
    roteiro = (config) => responder(config, 401)

    const erro = await http.get('/x').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).message).toBe('Sessão expirada. Faça login novamente.')
    expect((erro as ApiError).status).toBe(401)
  })

  it('ECONNABORTED vira mensagem de timeout', async () => {
    roteiro = (config) => Promise.reject(new AxiosError('timeout', 'ECONNABORTED', config))

    const erro = await http.get('/x').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).message).toBe('A solicitação demorou demais e foi cancelada.')
    expect((erro as ApiError).status).toBeUndefined()
  })

  it('erro sem resposta vira falha de conexão', async () => {
    roteiro = (config) => Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config))

    const erro = await http.get('/x').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).message).toBe('Não foi possível conectar ao servidor.')
    expect((erro as ApiError).status).toBeUndefined()
  })

  it('a mensagem do backend tem prioridade sobre as padrão', async () => {
    roteiro = (config) => responder(config, 422, { message: 'CPF duplicado.' })

    const erro = await http.get('/x').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).message).toBe('CPF duplicado.')
    expect((erro as ApiError).status).toBe(422)
  })
})

describe('refresh em 401', () => {
  /** `/despesas` só responde 200 com o token novo; `/auth/refresh` devolve a sessão nova. */
  function roteiroComRefresh(): void {
    roteiro = async (config, chamada) => {
      if (config.url === '/auth/refresh') {
        await esperar(10)
        return resposta(config, 200, sessao('novo', 'ref-novo'))
      }
      return chamada.authorization === 'Bearer novo'
        ? resposta(config, 200, { ok: true })
        : responder(config, 401)
    }
  }

  it('renova a sessão e repete a requisição original com o novo token', async () => {
    const auth = useAuthStore()
    auth.definirSessao(sessao('velho', 'ref'))
    roteiroComRefresh()

    const res = await http.get('/despesas')

    expect(res.data).toEqual({ ok: true })
    expect(urlsChamadas()).toEqual(['/despesas', '/auth/refresh', '/despesas'])
    expect(chamadasA('/auth/refresh')[0]?.corpo).toEqual({ refreshToken: 'ref' })
    expect(chamadasA('/despesas')[1]?.authorization).toBe('Bearer novo')
    expect(auth.accessToken).toBe('novo')
    expect(auth.refreshToken).toBe('ref-novo')
    expect(localStorage.getItem('simpleflow.accessToken')).toBe('novo')
    expect(assign).not.toHaveBeenCalled()
  })

  it('dispara uma única renovação para várias requisições 401 simultâneas', async () => {
    useAuthStore().definirSessao(sessao('velho', 'ref'))
    roteiroComRefresh()

    const resultados = await Promise.all([http.get('/a'), http.get('/b'), http.get('/c')])

    expect(resultados.map((r) => r.status)).toEqual([200, 200, 200])
    expect(chamadasA('/auth/refresh')).toHaveLength(1)
    expect(chamadasA('/a')).toHaveLength(2)
    expect(chamadasA('/b')).toHaveLength(2)
    expect(chamadasA('/c')).toHaveLength(2)
  })

  it('não vaza o estado de renovação: uma nova rodada de 401 renova de novo', async () => {
    const auth = useAuthStore()
    auth.definirSessao(sessao('velho', 'ref'))
    roteiroComRefresh()

    await http.get('/despesas')
    expect(chamadasA('/auth/refresh')).toHaveLength(1)

    auth.definirSessao(sessao('velho', 'ref'))
    await http.get('/despesas')

    expect(chamadasA('/auth/refresh')).toHaveLength(2)
  })

  it('requisição marcada como _retry não tenta renovar de novo', async () => {
    const auth = useAuthStore()
    auth.definirSessao(sessao('velho', 'ref'))
    roteiro = (config) => responder(config, 401)

    const erro = await http.get('/despesas', { _retry: true } as object).catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).status).toBe(401)
    expect(urlsChamadas()).toEqual(['/despesas'])
    expect(assign).not.toHaveBeenCalled()
  })

  it('não entra em loop quando a repetição também recebe 401', async () => {
    const auth = useAuthStore()
    auth.definirSessao(sessao('velho', 'ref'))
    roteiro = async (config) => {
      if (config.url === '/auth/refresh') return resposta(config, 200, sessao('novo', 'ref-novo'))
      return responder(config, 401)
    }

    const erro = await http.get('/despesas').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).status).toBe(401)
    expect(chamadasA('/despesas')).toHaveLength(2)
    expect(chamadasA('/auth/refresh')).toHaveLength(1)
    expect(auth.accessToken).toBeNull()
  })

  it('401 em rota /auth/* não tenta renovar', async () => {
    useAuthStore().definirSessao(sessao('velho', 'ref'))
    roteiro = (config) => responder(config, 401)

    const erro = await http.post('/auth/login', {}).catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).status).toBe(401)
    expect(urlsChamadas()).toEqual(['/auth/login'])
    expect(assign).not.toHaveBeenCalled()
  })

  it('401 sem refreshToken não tenta renovar', async () => {
    roteiro = (config) => responder(config, 401)

    const erro = await http.get('/despesas').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).status).toBe(401)
    expect(urlsChamadas()).toEqual(['/despesas'])
    expect(assign).not.toHaveBeenCalled()
  })

  it('falha no refresh limpa a sessão, redireciona para o login e rejeita com ApiError 401', async () => {
    const auth = useAuthStore()
    auth.definirSessao(sessao('velho', 'ref'))
    roteiro = (config) => responder(config, config.url === '/auth/refresh' ? 500 : 401)

    const erro = await http.get('/despesas').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).message).toBe('Sessão expirada. Faça login novamente.')
    expect((erro as ApiError).status).toBe(401)
    expect(auth.accessToken).toBeNull()
    expect(auth.refreshToken).toBeNull()
    expect(localStorage.getItem('simpleflow.accessToken')).toBeNull()
    expect(assign).toHaveBeenCalledWith('/auth/login')
  })

  it('após falha no refresh, o estado de renovação é liberado para a próxima tentativa', async () => {
    const auth = useAuthStore()
    auth.definirSessao(sessao('velho', 'ref'))
    roteiro = (config) => responder(config, config.url === '/auth/refresh' ? 500 : 401)
    await http.get('/despesas').catch(() => undefined)
    expect(chamadasA('/auth/refresh')).toHaveLength(1)

    auth.definirSessao(sessao('velho', 'ref'))
    roteiroComRefresh()
    const res = await http.get('/despesas')

    expect(res.status).toBe(200)
    expect(chamadasA('/auth/refresh')).toHaveLength(2)
  })
})
