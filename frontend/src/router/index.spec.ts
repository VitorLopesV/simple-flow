import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import router from '@/router'
import { useAuthStore } from '@/stores/authStore'

// Só `route.name`, `fullPath` e `meta` interessam: layouts e páginas viram componentes vazios.
const emptyComponent = vi.hoisted(() => ({ default: { render: () => null } }))
vi.mock('@/components/layouts/AppLayout.vue', () => emptyComponent)
vi.mock('@/components/layouts/AuthLayout.vue', () => emptyComponent)
vi.mock('@/pages/Dashboard.vue', () => emptyComponent)
vi.mock('@/pages/Incomes.vue', () => emptyComponent)
vi.mock('@/pages/Expenses.vue', () => emptyComponent)
vi.mock('@/pages/CreditCards.vue', () => emptyComponent)
vi.mock('@/pages/Login.vue', () => emptyComponent)
vi.mock('@/pages/Register.vue', () => emptyComponent)
vi.mock('@/pages/NotFound.vue', () => emptyComponent)

function authenticate(): void {
  useAuthStore().setSession({
    user: { id: 'usr_1', email: 'ana@exemplo.com', name: 'Ana' },
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresIn: 3600,
  })
}

/** Navega e devolve onde a navegação terminou, já com redirects e guards aplicados. */
async function go(destination: string) {
  await router.push(destination)
  return { name: router.currentRoute.value.name, path: router.currentRoute.value.fullPath }
}

const PRIVATE_ROUTES = ['/app/dashboard', '/app/entradas', '/app/saidas', '/app/cartoes']

beforeEach(async () => {
  localStorage.clear()
  setActivePinia(createPinia())
  // Ponto neutro (livre de guard) para que cada teste parta de uma navegação de verdade.
  await router.push('/__inicio__')
})

describe('sem sessão', () => {
  it.each(PRIVATE_ROUTES)('%s redireciona para o login', async (route) => {
    expect(await go(route)).toEqual({ name: 'login', path: '/auth/login' })
  })

  it('/app redireciona para o login', async () => {
    expect(await go('/app')).toEqual({ name: 'login', path: '/auth/login' })
  })

  it('rota desconhecida dentro de /app também cai no login', async () => {
    expect(await go('/app/inexistente')).toEqual({ name: 'login', path: '/auth/login' })
  })

  it('/auth/login e /auth/registro são liberados', async () => {
    expect(await go('/auth/registro')).toEqual({ name: 'register', path: '/auth/registro' })
    expect(await go('/auth/login')).toEqual({ name: 'login', path: '/auth/login' })
  })

  it('/ redireciona para o login', async () => {
    expect(await go('/')).toEqual({ name: 'login', path: '/auth/login' })
  })
})

describe('com sessão', () => {
  beforeEach(() => {
    authenticate()
  })

  it.each(PRIVATE_ROUTES)('%s é liberado', async (route) => {
    const { path } = await go(route)

    expect(path).toBe(route)
  })

  it.each(['/auth/login', '/auth/registro'])('%s redireciona para o dashboard', async (route) => {
    expect(await go(route)).toEqual({ name: 'dashboard', path: '/app/dashboard' })
  })

  it('/app redireciona para o dashboard', async () => {
    expect(await go('/app')).toEqual({ name: 'dashboard', path: '/app/dashboard' })
  })

  it('/ redireciona para o login e, já autenticado, segue para o dashboard', async () => {
    expect(await go('/')).toEqual({ name: 'dashboard', path: '/app/dashboard' })
  })

  it('rota desconhecida dentro de /app resolve para not-found', async () => {
    expect((await go('/app/inexistente')).name).toBe('not-found')
  })
})

describe('sessão lida a cada navegação', () => {
  it('logo após autenticar, a rota privada deixa de ser bloqueada', async () => {
    expect((await go('/app/saidas')).name).toBe('login')

    authenticate()

    expect((await go('/app/saidas')).name).toBe('expenses')
  })

  it('após o logout, a rota privada volta a ser bloqueada', async () => {
    authenticate()
    expect((await go('/app/saidas')).name).toBe('expenses')

    useAuthStore().clearSession()

    expect((await go('/app/entradas')).name).toBe('login')
  })
})

describe('rota inexistente', () => {
  it.each([false, true])('resolve para not-found (autenticado: %s)', async (withSession) => {
    if (withSession) authenticate()

    expect(await go('/uma/rota/qualquer')).toEqual({
      name: 'not-found',
      path: '/uma/rota/qualquer',
    })
  })
})

describe('título da página', () => {
  it.each(['/app/dashboard', '/app/entradas', '/app/saidas', '/app/cartoes'])(
    '%s mantém apenas "SimpleFlow"',
    async (route) => {
      authenticate()

      await go(route)

      expect(document.title).toBe('SimpleFlow')
    },
  )

  it('rotas de autenticação também usam apenas "SimpleFlow"', async () => {
    await go('/auth/registro')

    expect(document.title).toBe('SimpleFlow')
  })

  it('usa "SimpleFlow" também na 404', async () => {
    document.title = 'qualquer coisa'

    await go('/uma/rota/qualquer')

    expect(document.title).toBe('SimpleFlow')
  })
})
