import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Login from '@/pages/Login.vue'
import { authService } from '@/services/authService'

const push = vi.fn()

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/services/authService', () => ({
  authService: { login: vi.fn() },
}))

const loginMock = vi.mocked(authService.login)

const STUBS = { RouterLink: { template: '<a><slot /></a>' } }

let wrapper: VueWrapper | undefined

function montar() {
  wrapper = mount(Login, { global: { stubs: STUBS } })
  return wrapper
}

beforeEach(() => setActivePinia(createPinia()))

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.clearAllMocks()
})

describe('Login', () => {
  it('tem título, campos rotulados e botão de envio', () => {
    const tela = montar()

    expect(tela.get('h1').text()).toBe('Bem-vindo de volta')
    expect(tela.get('label[for]').text()).toContain('E-mail')
    expect(tela.find('input[autocomplete="email"]').exists()).toBe(true)
    expect(tela.find('input[autocomplete="current-password"]').exists()).toBe(true)
    expect(tela.get('button[type="submit"]').text()).toBe('Entrar')
  })

  it('aponta para o registro', () => {
    const tela = montar()

    expect(tela.text()).toContain('Registre-se aqui')
  })

  it('valida campos vazios com mensagens acessíveis e não chama o serviço', async () => {
    const tela = montar()

    await tela.get('form').trigger('submit')

    const alertas = tela.findAll('[role="alert"]').map((alerta) => alerta.text())
    expect(alertas).toEqual(['E-mail é obrigatório', 'Senha é obrigatória'])
    expect(tela.get('input[autocomplete="email"]').attributes('aria-invalid')).toBe('true')
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('rejeita e-mail inválido', async () => {
    const tela = montar()

    await tela.get('input[autocomplete="email"]').setValue('sem-arroba')
    await tela.get('input[autocomplete="current-password"]').setValue('123456')
    await tela.get('form').trigger('submit')

    expect(tela.text()).toContain('E-mail inválido')
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('envia as credenciais e vai para o dashboard', async () => {
    loginMock.mockResolvedValue({
      usuario: { id: 'u1', email: 'a@b.com', nome: null },
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 3600,
    })
    const tela = montar()

    await tela.get('input[autocomplete="email"]').setValue('a@b.com')
    await tela.get('input[autocomplete="current-password"]').setValue('123456')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(loginMock).toHaveBeenCalledWith({ email: 'a@b.com', senha: '123456' })
    expect(push).toHaveBeenCalledWith({ name: 'dashboard' })
  })
})
