import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { ApiError, http, getErrorMessage } from '@/services/http'
import { useAuthStore } from '@/stores/authStore'
import type { UserSession } from '@/types/auth'
import type { UserSessionDto } from '@/types/dto'

interface Call {
  url: string | undefined
  authorization: string | undefined
  body: unknown
}

type Script = (config: InternalAxiosRequestConfig, call: Call) => Promise<AxiosResponse>

const originalAdapter = http.defaults.adapter

let calls: Call[] = []
let script: Script

function response(config: InternalAxiosRequestConfig, status: number, data: unknown = {}): AxiosResponse {
  return { data, status, statusText: String(status), headers: {}, config }
}

/** Resolve para 2xx e rejeita com `AxiosError` para o resto, como o adapter real. */
function respond(config: InternalAxiosRequestConfig, status: number, data: unknown = {}): Promise<AxiosResponse> {
  const res = response(config, status, data)
  if (status >= 200 && status < 300) return Promise.resolve(res)
  return Promise.reject(new AxiosError(`Request failed ${status}`, 'ERR_BAD_REQUEST', config, null, res))
}

function session(accessToken: string, refreshToken: string): UserSession {
  return {
    user: { id: 'usr_1', email: 'a@b.com', name: 'Ana' },
    accessToken,
    refreshToken,
    expiresIn: 3600,
  }
}

/** Mesma sessão no formato devolvido por `/auth/refresh` (campos da API em português). */
function sessionDto(accessToken: string, refreshToken: string): UserSessionDto {
  return {
    usuario: { id: 'usr_1', email: 'a@b.com', nome: 'Ana' },
    accessToken,
    refreshToken,
    expiresIn: 3600,
  }
}

function calledUrls(): (string | undefined)[] {
  return calls.map((call) => call.url)
}

function callsTo(url: string): Call[] {
  return calls.filter((call) => call.url === url)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let assign: Mock<(url: string | URL) => void>

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  calls = []
  script = (config) => respond(config, 200, { ok: true })

  const adapter: AxiosAdapter = (config) => {
    const call: Call = {
      url: config.url,
      authorization: config.headers.get('Authorization') as string | undefined,
      body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
    }
    calls.push(call)
    return script(config, call)
  }
  http.defaults.adapter = adapter

  assign = vi.fn<(url: string | URL) => void>()
  vi.spyOn(window.location, 'assign').mockImplementation(assign)
})

afterEach(() => {
  http.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('getErrorMessage', () => {
  it('usa a mensagem de ApiError', () => {
    expect(getErrorMessage(new ApiError('Falhou aqui', 500))).toBe('Falhou aqui')
  })

  it('usa a mensagem de Error comum', () => {
    expect(getErrorMessage(new Error('erro comum'))).toBe('erro comum')
  })

  it('cai no padrão para valores que não são erro', () => {
    expect(getErrorMessage('texto')).toBe('Algo deu errado.')
    expect(getErrorMessage(undefined)).toBe('Algo deu errado.')
    expect(getErrorMessage(undefined, 'Padrão customizado')).toBe('Padrão customizado')
  })

  it('cai no padrão para Error sem mensagem', () => {
    expect(getErrorMessage(new Error(''), 'Vazio')).toBe('Vazio')
  })
})

describe('interceptor de request', () => {
  it('envia Authorization Bearer quando há accessToken', async () => {
    useAuthStore().setSession(session('abc', 'ref'))

    await http.get('/entradas')

    expect(calls[0]?.authorization).toBe('Bearer abc')
  })

  it('não envia o header sem token', async () => {
    await http.get('/entradas')

    expect(calls[0]?.authorization).toBeUndefined()
  })
})

describe('normalização de erro', () => {
  it.each([
    [404, 'Registro não encontrado.'],
    [400, 'Dados inválidos. Revise o formulário.'],
    [422, 'Dados inválidos. Revise o formulário.'],
    [500, 'O servidor não conseguiu processar a solicitação.'],
    [503, 'O servidor não conseguiu processar a solicitação.'],
  ])('status %i vira "%s"', async (status, message) => {
    script = (config) => respond(config, status)

    const error = await http.get('/x').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe(message)
    expect((error as ApiError).status).toBe(status)
  })

  it('401 sem refresh possível vira mensagem de sessão expirada', async () => {
    script = (config) => respond(config, 401)

    const error = await http.get('/x').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('Sessão expirada. Faça login novamente.')
    expect((error as ApiError).status).toBe(401)
  })

  it('ECONNABORTED vira mensagem de timeout', async () => {
    script = (config) => Promise.reject(new AxiosError('timeout', 'ECONNABORTED', config))

    const error = await http.get('/x').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('A solicitação demorou demais e foi cancelada.')
    expect((error as ApiError).status).toBeUndefined()
  })

  it('erro sem resposta vira falha de conexão', async () => {
    script = (config) => Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config))

    const error = await http.get('/x').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('Não foi possível conectar ao servidor.')
    expect((error as ApiError).status).toBeUndefined()
  })

  it('a mensagem do backend tem prioridade sobre as padrão', async () => {
    script = (config) => respond(config, 422, { message: 'CPF duplicado.' })

    const error = await http.get('/x').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('CPF duplicado.')
    expect((error as ApiError).status).toBe(422)
  })
})

describe('refresh em 401', () => {
  /** `/despesas` só responde 200 com o token novo; `/auth/refresh` devolve a sessão nova. */
  function scriptWithRefresh(): void {
    script = async (config, call) => {
      if (config.url === '/auth/refresh') {
        await wait(10)
        return response(config, 200, sessionDto('novo', 'ref-novo'))
      }
      return call.authorization === 'Bearer novo'
        ? response(config, 200, { ok: true })
        : respond(config, 401)
    }
  }

  it('renova a sessão e repete a requisição original com o novo token', async () => {
    const auth = useAuthStore()
    auth.setSession(session('velho', 'ref'))
    scriptWithRefresh()

    const res = await http.get('/despesas')

    expect(res.data).toEqual({ ok: true })
    expect(calledUrls()).toEqual(['/despesas', '/auth/refresh', '/despesas'])
    expect(callsTo('/auth/refresh')[0]?.body).toEqual({ refreshToken: 'ref' })
    expect(callsTo('/despesas')[1]?.authorization).toBe('Bearer novo')
    expect(auth.accessToken).toBe('novo')
    expect(auth.refreshToken).toBe('ref-novo')
    // A sessão chega no formato da API e é convertida antes de ir para a store.
    expect(auth.user).toEqual({ id: 'usr_1', email: 'a@b.com', name: 'Ana' })
    expect(localStorage.getItem('simpleflow.accessToken')).toBe('novo')
    expect(assign).not.toHaveBeenCalled()
  })

  it('dispara uma única renovação para várias requisições 401 simultâneas', async () => {
    useAuthStore().setSession(session('velho', 'ref'))
    scriptWithRefresh()

    const results = await Promise.all([http.get('/a'), http.get('/b'), http.get('/c')])

    expect(results.map((r) => r.status)).toEqual([200, 200, 200])
    expect(callsTo('/auth/refresh')).toHaveLength(1)
    expect(callsTo('/a')).toHaveLength(2)
    expect(callsTo('/b')).toHaveLength(2)
    expect(callsTo('/c')).toHaveLength(2)
  })

  it('não vaza o estado de renovação: uma nova rodada de 401 renova de novo', async () => {
    const auth = useAuthStore()
    auth.setSession(session('velho', 'ref'))
    scriptWithRefresh()

    await http.get('/despesas')
    expect(callsTo('/auth/refresh')).toHaveLength(1)

    auth.setSession(session('velho', 'ref'))
    await http.get('/despesas')

    expect(callsTo('/auth/refresh')).toHaveLength(2)
  })

  it('requisição marcada como _retry não tenta renovar de novo', async () => {
    const auth = useAuthStore()
    auth.setSession(session('velho', 'ref'))
    script = (config) => respond(config, 401)

    const error = await http.get('/despesas', { _retry: true } as object).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect(calledUrls()).toEqual(['/despesas'])
    expect(assign).not.toHaveBeenCalled()
  })

  it('não entra em loop quando a repetição também recebe 401', async () => {
    const auth = useAuthStore()
    auth.setSession(session('velho', 'ref'))
    script = async (config) => {
      if (config.url === '/auth/refresh') return response(config, 200, sessionDto('novo', 'ref-novo'))
      return respond(config, 401)
    }

    const error = await http.get('/despesas').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect(callsTo('/despesas')).toHaveLength(2)
    expect(callsTo('/auth/refresh')).toHaveLength(1)
    expect(auth.accessToken).toBeNull()
  })

  it('401 em rota /auth/* não tenta renovar', async () => {
    useAuthStore().setSession(session('velho', 'ref'))
    script = (config) => respond(config, 401)

    const error = await http.post('/auth/login', {}).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect(calledUrls()).toEqual(['/auth/login'])
    expect(assign).not.toHaveBeenCalled()
  })

  it('401 sem refreshToken não tenta renovar', async () => {
    script = (config) => respond(config, 401)

    const error = await http.get('/despesas').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect(calledUrls()).toEqual(['/despesas'])
    expect(assign).not.toHaveBeenCalled()
  })

  it('falha no refresh limpa a sessão, redireciona para o login e rejeita com ApiError 401', async () => {
    const auth = useAuthStore()
    auth.setSession(session('velho', 'ref'))
    script = (config) => respond(config, config.url === '/auth/refresh' ? 500 : 401)

    const error = await http.get('/despesas').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('Sessão expirada. Faça login novamente.')
    expect((error as ApiError).status).toBe(401)
    expect(auth.accessToken).toBeNull()
    expect(auth.refreshToken).toBeNull()
    expect(localStorage.getItem('simpleflow.accessToken')).toBeNull()
    expect(assign).toHaveBeenCalledWith('/auth/login')
  })

  it('após falha no refresh, o estado de renovação é liberado para a próxima tentativa', async () => {
    const auth = useAuthStore()
    auth.setSession(session('velho', 'ref'))
    script = (config) => respond(config, config.url === '/auth/refresh' ? 500 : 401)
    await http.get('/despesas').catch(() => undefined)
    expect(callsTo('/auth/refresh')).toHaveLength(1)

    auth.setSession(session('velho', 'ref'))
    scriptWithRefresh()
    const res = await http.get('/despesas')

    expect(res.status).toBe(200)
    expect(callsTo('/auth/refresh')).toHaveLength(2)
  })
})

describe('USE_MOCK', () => {
  /** A constante é lida na importação: recarrega o módulo com a variável de ambiente pedida. */
  async function useMockWith(value: string | undefined): Promise<boolean> {
    vi.stubEnv('VITE_USE_MOCK', value as string)
    vi.resetModules()
    const module = await import('@/services/http')
    return module.USE_MOCK
  }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("só liga o mock com 'true' explícito", async () => {
    expect(await useMockWith('true')).toBe(true)
  })

  it.each([undefined, '', 'false', 'TRUE', '1', 'yes'])(
    'usa o backend real quando a variável vale %j (padrão seguro para deploy)',
    async (value) => {
      expect(await useMockWith(value)).toBe(false)
    },
  )
})
