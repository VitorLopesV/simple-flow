import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ProfileModal from '@/components/features/ProfileModal.vue'
import UserMenu from '@/components/features/UserMenu.vue'
import { useAuthStore } from '@/stores/authStore'

const push = vi.fn()

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

let wrapper: VueWrapper | undefined

function mountComponent(user: Record<string, unknown> = {}) {
  localStorage.clear()
  setActivePinia(createPinia())
  useAuthStore().setSession({
    user: { id: 'u1', email: 'ana@exemplo.com', name: 'Ana', ...user },
    accessToken: 'a',
    refreshToken: 'r',
    expiresIn: 3600,
  })

  wrapper = mount(UserMenu, { global: { stubs: { ProfileModal: true } }, attachTo: document.body })
  return wrapper
}

const trigger = (screen: VueWrapper) => screen.get('button[aria-label="Menu de usuário"]')
const item = (screen: VueWrapper, text: string) =>
  screen.findAll('[role="menuitem"]').find((b) => b.text().includes(text))
const profileOpen = (screen: VueWrapper) => screen.findComponent(ProfileModal).props('open')

beforeEach(() => vi.clearAllMocks())

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('menu do usuário', () => {
  it('começa fechado e o perfil não abre direto ao clicar no ícone', async () => {
    const screen = mountComponent()

    expect(screen.find('[role="menu"]').exists()).toBe(false)

    await trigger(screen).trigger('click')

    expect(screen.find('[role="menu"]').exists()).toBe(true)
    expect(trigger(screen).attributes('aria-expanded')).toBe('true')
    expect(profileOpen(screen)).toBe(false)
  })

  it('mostra e-mail e nome do usuário, com "Meu perfil" e "Sair"', async () => {
    const screen = mountComponent()

    await trigger(screen).trigger('click')

    const menu = screen.get('[role="menu"]')
    expect(menu.text()).toContain('ana@exemplo.com')
    expect(menu.text()).toContain('Ana')
    expect(item(screen, 'Meu perfil')).toBeTruthy()
    expect(item(screen, 'Sair')).toBeTruthy()
  })

  it('mostra a foto do usuário no ícone quando existe', async () => {
    const screen = mountComponent({ photoUrl: 'data:image/jpeg;base64,FOTO' })

    expect(trigger(screen).get('img').attributes('src')).toBe('data:image/jpeg;base64,FOTO')
  })

  it('o botão do avatar tem 56px de diâmetro', () => {
    const screen = mountComponent()

    expect(trigger(screen).classes()).toContain('!size-[56px]')
  })

  it('clicar de novo no ícone fecha o menu', async () => {
    const screen = mountComponent()

    await trigger(screen).trigger('click')
    await trigger(screen).trigger('click')

    expect(screen.find('[role="menu"]').exists()).toBe(false)
  })

  it('fecha ao clicar fora e com Esc', async () => {
    const screen = mountComponent()

    await trigger(screen).trigger('click')
    await screen.get('[data-testid="menu-backdrop"]').trigger('click')
    expect(screen.find('[role="menu"]').exists()).toBe(false)

    await trigger(screen).trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await screen.vm.$nextTick()
    expect(screen.find('[role="menu"]').exists()).toBe(false)
  })

  it('fecha quando o foco sai do menu (ex.: Shift+Tab até o sino), para não sobrepor as notificações', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    const screen = mountComponent()

    await trigger(screen).trigger('click')
    await trigger(screen).trigger('focusout', { relatedTarget: item(screen, 'Meu perfil')!.element })
    expect(screen.find('[role="menu"]').exists()).toBe(true)

    await trigger(screen).trigger('focusout', { relatedTarget: outside })
    expect(screen.find('[role="menu"]').exists()).toBe(false)
  })
})

describe('ações do menu', () => {
  it('"Meu perfil" fecha o menu e abre o modal de perfil', async () => {
    const screen = mountComponent()
    await trigger(screen).trigger('click')

    await item(screen, 'Meu perfil')!.trigger('click')

    expect(screen.find('[role="menu"]').exists()).toBe(false)
    expect(profileOpen(screen)).toBe(true)
  })

  it('"Sair" limpa a sessão, fecha o menu e vai para o login', async () => {
    const screen = mountComponent()
    await trigger(screen).trigger('click')

    await item(screen, 'Sair')!.trigger('click')
    await flushPromises()

    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(screen.find('[role="menu"]').exists()).toBe(false)
    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })
})
