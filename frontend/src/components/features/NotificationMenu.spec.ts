import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import NotificationMenu from '@/components/features/NotificationMenu.vue'
import type { AppNotification } from '@/types/notification'

const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    title: 'Fatura Itaú Click vence em 4 dias',
    description: 'Valor atual da fatura: R$ 2.393,00.',
    date: '2026-10-08',
  },
  {
    id: 'n2',
    title: 'Conta de luz vencida',
    description: 'A saída está pendente e o vencimento já passou.',
    date: '2026-10-05',
  },
]

let wrapper: VueWrapper | undefined

function mountComponent(notifications: AppNotification[] = []) {
  wrapper = mount(NotificationMenu, { props: { notifications }, attachTo: document.body })
  return wrapper
}

const bell = (screen: VueWrapper) => screen.get('button[aria-haspopup="dialog"]')
const popup = (screen: VueWrapper) => screen.find('[role="dialog"]')
const badge = (screen: VueWrapper) => screen.find('[data-testid="notification-badge"]')

async function open(screen: VueWrapper) {
  await bell(screen).trigger('click')
  await screen.vm.$nextTick()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('botão de notificações', () => {
  it('é um botão de sino com nome acessível, fechado de início', () => {
    const screen = mountComponent()

    expect(bell(screen).attributes('aria-label')).toBe('Notificações')
    expect(bell(screen).attributes('aria-expanded')).toBe('false')
    expect(bell(screen).find('[data-testid="notification-icon"]').exists()).toBe(true)
    expect(popup(screen).exists()).toBe(false)
  })

  it('mostra só o ícone, sem círculo nem borda, e fica verde no hover', () => {
    const screen = mountComponent()

    expect(bell(screen).classes()).not.toContain('border-2')
    expect(bell(screen).classes()).not.toContain('!rounded-full')
    expect(bell(screen).classes()).toContain('hover:!text-success')
  })

  it('sem alertas, não mostra badge', () => {
    const screen = mountComponent()

    expect(badge(screen).exists()).toBe(false)
  })

  it('com alertas, mostra o badge com a quantidade e a anuncia no nome acessível', () => {
    const screen = mountComponent(NOTIFICATIONS)

    expect(badge(screen).text()).toBe('2')
    expect(badge(screen).attributes('aria-hidden')).toBe('true')
    expect(bell(screen).attributes('aria-label')).toBe('Notificações: 2 alertas')
  })

  it('usa o singular com um alerta', () => {
    const screen = mountComponent(NOTIFICATIONS.slice(0, 1))

    expect(bell(screen).attributes('aria-label')).toBe('Notificações: 1 alerta')
  })

  it('limita o badge em "9+"', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...NOTIFICATIONS[0]!, id: `n${i}` }))
    const screen = mountComponent(many)

    expect(badge(screen).text()).toBe('9+')
  })

  it('o badge acompanha a lista recebida', async () => {
    const screen = mountComponent()

    await screen.setProps({ notifications: NOTIFICATIONS })

    expect(badge(screen).text()).toBe('2')
  })
})

describe('popup', () => {
  it('abre ao clicar no sino, ligado ao botão por aria-controls', async () => {
    const screen = mountComponent()

    await open(screen)

    expect(popup(screen).exists()).toBe(true)
    expect(bell(screen).attributes('aria-expanded')).toBe('true')
    expect(bell(screen).attributes('aria-controls')).toBe(popup(screen).attributes('id'))
  })

  it('leva o foco para o popup, nomeado pelo título', async () => {
    const screen = mountComponent()

    await open(screen)

    const dialog = popup(screen)
    expect(document.activeElement).toBe(dialog.element)
    expect(document.getElementById(dialog.attributes('aria-labelledby')!)?.textContent).toBe('Notificações')
    expect(dialog.attributes('aria-describedby')).toBeTruthy()
  })

  it('sem alertas, mostra a mensagem carinhosa de estado vazio', async () => {
    const screen = mountComponent()

    await open(screen)

    const empty = screen.get('[data-testid="notifications-empty"]')
    expect(empty.text()).toContain('Tudo em dia por aqui!')
    expect(empty.text()).toContain('Nenhuma notificação no momento 💚')
    expect(screen.findAll('[data-testid="notification-item"]')).toHaveLength(0)
  })

  it('lista os alertas com título, descrição curta e data', async () => {
    const screen = mountComponent(NOTIFICATIONS)

    await open(screen)

    const items = screen.findAll('[data-testid="notification-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]?.text()).toContain('Fatura Itaú Click vence em 4 dias')
    expect(items[0]?.text()).toContain('Valor atual da fatura: R$ 2.393,00.')
    expect(items[0]?.get('time').text()).toBe('08/10/2026')
    expect(items[0]?.get('time').attributes('datetime')).toBe('2026-10-08')
    expect(popup(screen).text()).toContain('2 alertas')
    expect(screen.find('[data-testid="notifications-empty"]').exists()).toBe(false)
  })

  it('clicar de novo no sino fecha', async () => {
    const screen = mountComponent()

    await open(screen)
    await bell(screen).trigger('click')

    expect(popup(screen).exists()).toBe(false)
    expect(bell(screen).attributes('aria-expanded')).toBe('false')
  })

  it('fecha ao clicar fora, mas não ao clicar dentro do popup', async () => {
    const screen = mountComponent(NOTIFICATIONS)
    await open(screen)

    popup(screen).element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await screen.vm.$nextTick()
    expect(popup(screen).exists()).toBe(true)

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await screen.vm.$nextTick()
    expect(popup(screen).exists()).toBe(false)
  })

  it('fecha com Esc e devolve o foco ao sino', async () => {
    const screen = mountComponent()
    await open(screen)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await screen.vm.$nextTick()

    expect(popup(screen).exists()).toBe(false)
    expect(document.activeElement).toBe(bell(screen).element)
  })

  it('fecha quando o foco sai do componente (ex.: Tab até o menu de usuário)', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    const screen = mountComponent()
    await open(screen)

    await popup(screen).trigger('focusout', { relatedTarget: outside })

    expect(popup(screen).exists()).toBe(false)
  })

  it('continua aberto quando o foco volta para o sino', async () => {
    const screen = mountComponent()
    await open(screen)

    await popup(screen).trigger('focusout', { relatedTarget: bell(screen).element })

    expect(popup(screen).exists()).toBe(true)
  })
})
