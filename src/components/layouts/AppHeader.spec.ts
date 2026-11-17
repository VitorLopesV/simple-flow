import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import NotificationMenu from '@/components/features/NotificationMenu.vue'
import UserMenu from '@/components/features/UserMenu.vue'
import AppHeader from '@/components/layouts/AppHeader.vue'
import { notificationService } from '@/services/notificationService'
import { useNotificationStore } from '@/stores/notificationStore'

vi.mock('@/services/notificationService', () => ({ notificationService: { list: vi.fn() } }))

const listMock = vi.mocked(notificationService.list)

let wrapper: VueWrapper | undefined

function mountComponent() {
  wrapper = mount(AppHeader, { global: { stubs: { UserMenu: true } } })
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  listMock.mockReset()
  listMock.mockResolvedValue([])
})

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

  it('o sino recebe os alertas do store (vazio sem alertas)', async () => {
    const screen = mountComponent()

    expect(screen.findComponent(NotificationMenu).props('notifications')).toEqual([])

    useNotificationStore().notifications = [
      { id: 'n1', title: 'Fatura vence amanhã', description: 'Itaú Click', date: '2026-10-08' },
    ]
    await screen.vm.$nextTick()

    expect(screen.findComponent(NotificationMenu).props('notifications')).toHaveLength(1)
    expect(screen.get('[data-testid="notification-badge"]').text()).toBe('1')
  })

  it('carrega os alertas ao montar e recarrega ao abrir o sino', async () => {
    listMock.mockResolvedValue([{ id: 'a1', kind: 'TAREFA_ATRASADA', title: 'Tarefa atrasada', description: 'x', date: '2026-11-17' }])
    const screen = mountComponent()
    await flushPromises()

    expect(listMock).toHaveBeenCalledTimes(1)
    expect(screen.get('[data-testid="notification-badge"]').text()).toBe('1')

    await screen.get('button[aria-haspopup="dialog"]').trigger('click')
    await flushPromises()

    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('abrir o sino marca os alertas como vistos e zera o contador', async () => {
    listMock.mockResolvedValue([{ id: 'a1', kind: 'TAREFA_ATRASADA', title: 'Tarefa atrasada', description: 'x', date: '2026-11-17' }])
    const screen = mountComponent()
    await flushPromises()

    await screen.get('button[aria-haspopup="dialog"]').trigger('click')
    await flushPromises()

    expect(useNotificationStore().seenIds).toEqual(['a1'])
    expect(screen.find('[data-testid="notification-badge"]').exists()).toBe(false)
  })
})
