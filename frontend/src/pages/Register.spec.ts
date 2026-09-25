import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Register from '@/pages/Register.vue'
import { authService } from '@/services/authService'

const push = vi.fn()

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/services/authService', () => ({
  authService: { registrar: vi.fn() },
}))

const registrarMock = vi.mocked(authService.registrar)

const STUBS = { RouterLink: { template: '<a><slot /></a>' } }

let wrapper: VueWrapper | undefined

function montar() {
  wrapper = mount(Register, { global: { stubs: STUBS } })
  return wrapper
}

async function preencher(tela: VueWrapper, valores: Record<string, string>) {
  for (const [autocomplete, valor] of Object.entries(valores)) {
    const campos = tela.findAll(`input[autocomplete="${autocomplete}"]`)
    await campos[campos.length - 1]!.setValue(valor)
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
    const tela = montar()

    expect(tela.get('h1').text()).toBe('Criar uma conta')
    expect(tela.findAll('input')).toHaveLength(5)
    expect(tela.get('button[type="submit"]').text()).toBe('Registrar')
    expect(tela.text()).toContain('Faça login')
  })

  it('valida campos vazios e não chama o serviço', async () => {
    const tela = montar()

    await tela.get('form').trigger('submit')

    expect(tela.findAll('[role="alert"]')).toHaveLength(5)
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('exige senhas iguais', async () => {
    const tela = montar()

    await preencher(tela, {
      username: 'vitor',
      email: 'a@b.com',
      tel: '11999999999',
    })
    const senhas = tela.findAll('input[autocomplete="new-password"]')
    await senhas[0]!.setValue('123456')
    await senhas[1]!.setValue('654321')
    await tela.get('form').trigger('submit')

    expect(tela.text()).toContain('As senhas não coincidem')
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('formata o telefone enquanto digita', async () => {
    const tela = montar()

    await tela.get('input[autocomplete="tel"]').setValue('11999998888')

    expect((tela.get('input[autocomplete="tel"]').element as HTMLInputElement).value).toBe(
      '(11) 99999-8888',
    )
  })

  it('registra e vai para o dashboard', async () => {
    registrarMock.mockResolvedValue({
      usuario: { id: 'u1', email: 'a@b.com', nome: 'vitor' },
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 3600,
    })
    const tela = montar()

    await preencher(tela, { username: 'vitor', email: 'a@b.com', tel: '11999998888' })
    const senhas = tela.findAll('input[autocomplete="new-password"]')
    await senhas[0]!.setValue('123456')
    await senhas[1]!.setValue('123456')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(registrarMock).toHaveBeenCalledWith({ email: 'a@b.com', senha: '123456', nome: 'vitor' })
    expect(push).toHaveBeenCalledWith({ name: 'dashboard' })
  })
})
