import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import router from '@/router'
import { useAuthStore } from '@/stores/authStore'

// Só `route.name`, `fullPath` e `meta` interessam: layouts e páginas viram componentes vazios.
const componenteVazio = vi.hoisted(() => ({ default: { render: () => null } }))
vi.mock('@/components/layouts/AppLayout.vue', () => componenteVazio)
vi.mock('@/components/layouts/AuthLayout.vue', () => componenteVazio)
vi.mock('@/pages/Dashboard.vue', () => componenteVazio)
vi.mock('@/pages/Entradas.vue', () => componenteVazio)
vi.mock('@/pages/Saidas.vue', () => componenteVazio)
vi.mock('@/pages/Cartoes.vue', () => componenteVazio)
vi.mock('@/pages/Login.vue', () => componenteVazio)
vi.mock('@/pages/Register.vue', () => componenteVazio)
vi.mock('@/pages/NotFound.vue', () => componenteVazio)

function autenticar(): void {
  useAuthStore().definirSessao({
    usuario: { id: 'usr_1', email: 'ana@exemplo.com', nome: 'Ana' },
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresIn: 3600,
  })
}

/** Navega e devolve onde a navegação terminou, já com redirects e guards aplicados. */
async function ir(destino: string) {
  await router.push(destino)
  return { nome: router.currentRoute.value.name, caminho: router.currentRoute.value.fullPath }
}

const ROTAS_PRIVADAS = ['/app/dashboard', '/app/entradas', '/app/saidas', '/app/cartoes']

beforeEach(async () => {
  localStorage.clear()
  setActivePinia(createPinia())
  // Ponto neutro (livre de guard) para que cada teste parta de uma navegação de verdade.
  await router.push('/__inicio__')
})

describe('sem sessão', () => {
  it.each(ROTAS_PRIVADAS)('%s redireciona para o login', async (rota) => {
    expect(await ir(rota)).toEqual({ nome: 'login', caminho: '/auth/login' })
  })

  it('/app redireciona para o login', async () => {
    expect(await ir('/app')).toEqual({ nome: 'login', caminho: '/auth/login' })
  })

  it('rota desconhecida dentro de /app também cai no login', async () => {
    expect(await ir('/app/inexistente')).toEqual({ nome: 'login', caminho: '/auth/login' })
  })

  it('/auth/login e /auth/registro são liberados', async () => {
    expect(await ir('/auth/registro')).toEqual({ nome: 'registro', caminho: '/auth/registro' })
    expect(await ir('/auth/login')).toEqual({ nome: 'login', caminho: '/auth/login' })
  })

  it('/ redireciona para o login', async () => {
    expect(await ir('/')).toEqual({ nome: 'login', caminho: '/auth/login' })
  })
})

describe('com sessão', () => {
  beforeEach(() => {
    autenticar()
  })

  it.each(ROTAS_PRIVADAS)('%s é liberado', async (rota) => {
    const { caminho } = await ir(rota)

    expect(caminho).toBe(rota)
  })

  it.each(['/auth/login', '/auth/registro'])('%s redireciona para o dashboard', async (rota) => {
    expect(await ir(rota)).toEqual({ nome: 'dashboard', caminho: '/app/dashboard' })
  })

  it('/app redireciona para o dashboard', async () => {
    expect(await ir('/app')).toEqual({ nome: 'dashboard', caminho: '/app/dashboard' })
  })

  it('/ redireciona para o login e, já autenticado, segue para o dashboard', async () => {
    expect(await ir('/')).toEqual({ nome: 'dashboard', caminho: '/app/dashboard' })
  })

  it('rota desconhecida dentro de /app resolve para nao-encontrado', async () => {
    expect((await ir('/app/inexistente')).nome).toBe('nao-encontrado')
  })
})

describe('sessão lida a cada navegação', () => {
  it('logo após autenticar, a rota privada deixa de ser bloqueada', async () => {
    expect((await ir('/app/saidas')).nome).toBe('login')

    autenticar()

    expect((await ir('/app/saidas')).nome).toBe('saidas')
  })

  it('após o logout, a rota privada volta a ser bloqueada', async () => {
    autenticar()
    expect((await ir('/app/saidas')).nome).toBe('saidas')

    useAuthStore().limparSessao()

    expect((await ir('/app/entradas')).nome).toBe('login')
  })
})

describe('rota inexistente', () => {
  it.each([false, true])('resolve para nao-encontrado (autenticado: %s)', async (comSessao) => {
    if (comSessao) autenticar()

    expect(await ir('/uma/rota/qualquer')).toEqual({
      nome: 'nao-encontrado',
      caminho: '/uma/rota/qualquer',
    })
  })
})

describe('título da página', () => {
  it.each(['/app/dashboard', '/app/entradas', '/app/saidas', '/app/cartoes'])(
    '%s mantém apenas "SimpleFlow"',
    async (rota) => {
      autenticar()

      await ir(rota)

      expect(document.title).toBe('SimpleFlow')
    },
  )

  it('rotas de autenticação também usam apenas "SimpleFlow"', async () => {
    await ir('/auth/registro')

    expect(document.title).toBe('SimpleFlow')
  })

  it('usa "SimpleFlow" também na 404', async () => {
    document.title = 'qualquer coisa'

    await ir('/uma/rota/qualquer')

    expect(document.title).toBe('SimpleFlow')
  })
})
