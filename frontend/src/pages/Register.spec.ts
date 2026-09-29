import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Register from '@/pages/Register.vue'
import { authService } from '@/services/authService'

const push = vi.fn()

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/services/authService', () => ({
  authService: { register: vi.fn() },
}))

const registerMock = vi.mocked(authService.register)

const STUBS = { RouterLink: { template: '<a><slot /></a>' } }

let wrapper: VueWrapper | undefined

function mountComponent() {
  wrapper = mount(Register, { global: { stubs: STUBS } })
  return wrapper
}

async function fill(screen: VueWrapper, values: Record<string, string>) {
  for (const [autocomplete, amount] of Object.entries(values)) {
    const fields = screen.findAll(`input[autocomplete="${autocomplete}"]`)
    await fields[fields.length - 1]!.setValue(amount)
  }
}

beforeEach(() => setActivePinia(createPinia()))

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.clearAllMocks()
})

describe('Register', () => {
  it('tem título, cinco campos e botão de envio', () => {
    const screen = mountComponent()

    expect(screen.get('h1').text()).toBe('Criar uma conta')
    expect(screen.findAll('input')).toHaveLength(5)
    expect(screen.get('button[type="submit"]').text()).toBe('Registrar')
    expect(screen.text()).toContain('Faça login')
  })

  it('valida campos vazios e não chama o serviço', async () => {
    const screen = mountComponent()

    await screen.get('form').trigger('submit')

    expect(screen.findAll('[role="alert"]')).toHaveLength(5)
    expect(registerMock).not.toHaveBeenCalled()
  })

  it('exige senhas iguais', async () => {
    const screen = mountComponent()

    await fill(screen, {
      username: 'vitor',
      email: 'a@b.com',
      tel: '11999999999',
    })
    const passwords = screen.findAll('input[autocomplete="new-password"]')
    await passwords[0]!.setValue('123456')
    await passwords[1]!.setValue('654321')
    await screen.get('form').trigger('submit')

    expect(screen.text()).toContain('As senhas não coincidem')
    expect(registerMock).not.toHaveBeenCalled()
  })

  it('formata o telefone enquanto digita', async () => {
    const screen = mountComponent()

    await screen.get('input[autocomplete="tel"]').setValue('11999998888')

    expect((screen.get('input[autocomplete="tel"]').element as HTMLInputElement).value).toBe(
      '(11) 99999-8888',
    )
  })

  it('registra e vai para o dashboard', async () => {
    registerMock.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', name: 'vitor' },
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 3600,
    })
    const screen = mountComponent()

    await fill(screen, { username: 'vitor', email: 'a@b.com', tel: '11999998888' })
    const passwords = screen.findAll('input[autocomplete="new-password"]')
    await passwords[0]!.setValue('123456')
    await passwords[1]!.setValue('123456')
    await screen.get('form').trigger('submit')
    await flushPromises()

    expect(registerMock).toHaveBeenCalledWith({ email: 'a@b.com', password: '123456', name: 'vitor' })
    expect(push).toHaveBeenCalledWith({ name: 'dashboard' })
  })
})
