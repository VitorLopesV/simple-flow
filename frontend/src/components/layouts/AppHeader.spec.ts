import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import NotificationMenu from '@/components/features/NotificationMenu.vue'
import UserMenu from '@/components/features/UserMenu.vue'
import AppHeader from '@/components/layouts/AppHeader.vue'
import { useNotificationStore } from '@/stores/notificationStore'

let wrapper: VueWrapper | undefined

function mountComponent() {
  wrapper = mount(AppHeader, { global: { stubs: { UserMenu: true } } })
  return wrapper
}

beforeEach(() => setActivePinia(createPinia()))

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('cabeçalho', () => {
  it('mostra o sino de notificações logo antes do menu de usuário', () => {
    const screen = mountComponent()

    const bell = screen.findComponent(NotificationMenu)
    const user = screen.findComponent(UserMenu)
    expect(bell.exists()).toBe(true)
    expect(bell.element.parentElement).toBe(user.element.parentElement)
    expect(bell.element.nextElementSibling).toBe(user.element)
  })

  it('o sino recebe os alertas do store (vazio por enquanto)', async () => {
    const screen = mountComponent()

    expect(screen.findComponent(NotificationMenu).props('notifications')).toEqual([])

    useNotificationStore().notifications = [
      { id: 'n1', title: 'Fatura vence amanhã', description: 'Itaú Click', date: '2026-10-08' },
    ]
    await screen.vm.$nextTick()

    expect(screen.findComponent(NotificationMenu).props('notifications')).toHaveLength(1)
    expect(screen.get('[data-testid="notification-badge"]').text()).toBe('1')
  })
})
