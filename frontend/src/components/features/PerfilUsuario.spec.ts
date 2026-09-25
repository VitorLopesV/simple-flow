import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PerfilModal from '@/components/features/PerfilModal.vue'
import PerfilUsuario from '@/components/features/PerfilUsuario.vue'
import { useAuthStore } from '@/stores/authStore'

const push = vi.fn()

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

let wrapper: VueWrapper | undefined

function montar(usuario: Record<string, unknown> = {}) {
  localStorage.clear()
  setActivePinia(createPinia())
  useAuthStore().definirSessao({
    usuario: { id: 'u1', email: 'ana@exemplo.com', nome: 'Ana', ...usuario },
    accessToken: 'a',
    refreshToken: 'r',
    expiresIn: 3600,
  })

  wrapper = mount(PerfilUsuario, { global: { stubs: { PerfilModal: true } }, attachTo: document.body })
  return wrapper
}

const gatilho = (tela: VueWrapper) => tela.get('button[aria-label="Menu de usuário"]')
const item = (tela: VueWrapper, texto: string) =>
  tela.findAll('[role="menuitem"]').find((b) => b.text().includes(texto))
const perfilAberto = (tela: VueWrapper) => tela.findComponent(PerfilModal).props('aberto')

beforeEach(() => vi.clearAllMocks())

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('menu do usuário', () => {
  it('começa fechado e o perfil não abre direto ao clicar no ícone', async () => {
    const tela = montar()

    expect(tela.find('[role="menu"]').exists()).toBe(false)

    await gatilho(tela).trigger('click')

    expect(tela.find('[role="menu"]').exists()).toBe(true)
    expect(gatilho(tela).attributes('aria-expanded')).toBe('true')
    expect(perfilAberto(tela)).toBe(false)
  })

  it('mostra e-mail e nome do usuário, com "Meu perfil" e "Sair"', async () => {
    const tela = montar()

    await gatilho(tela).trigger('click')

    const menu = tela.get('[role="menu"]')
    expect(menu.text()).toContain('ana@exemplo.com')
    expect(menu.text()).toContain('Ana')
    expect(item(tela, 'Meu perfil')).toBeTruthy()
    expect(item(tela, 'Sair')).toBeTruthy()
  })

  it('mostra a foto do usuário no ícone quando existe', async () => {
    const tela = montar({ fotoUrl: 'data:image/jpeg;base64,FOTO' })

    expect(gatilho(tela).get('img').attributes('src')).toBe('data:image/jpeg;base64,FOTO')
  })

  it('clicar de novo no ícone fecha o menu', async () => {
    const tela = montar()

    await gatilho(tela).trigger('click')
    await gatilho(tela).trigger('click')

    expect(tela.find('[role="menu"]').exists()).toBe(false)
  })

  it('fecha ao clicar fora e com Esc', async () => {
    const tela = montar()

    await gatilho(tela).trigger('click')
    await tela.get('[data-testid="fundo-menu"]').trigger('click')
    expect(tela.find('[role="menu"]').exists()).toBe(false)

    await gatilho(tela).trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await tela.vm.$nextTick()
    expect(tela.find('[role="menu"]').exists()).toBe(false)
  })
})

describe('ações do menu', () => {
  it('"Meu perfil" fecha o menu e abre o modal de perfil', async () => {
    const tela = montar()
    await gatilho(tela).trigger('click')

    await item(tela, 'Meu perfil')!.trigger('click')

    expect(tela.find('[role="menu"]').exists()).toBe(false)
    expect(perfilAberto(tela)).toBe(true)
  })

  it('"Sair" limpa a sessão, fecha o menu e vai para o login', async () => {
    const tela = montar()
    await gatilho(tela).trigger('click')

    await item(tela, 'Sair')!.trigger('click')
    await flushPromises()

    expect(useAuthStore().autenticado).toBe(false)
    expect(tela.find('[role="menu"]').exists()).toBe(false)
    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })
})
