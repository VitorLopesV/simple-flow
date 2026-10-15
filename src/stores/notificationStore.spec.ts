import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useNotificationStore } from '@/stores/notificationStore'

beforeEach(() => setActivePinia(createPinia()))

describe('notificationStore', () => {
  it('começa sem alertas (a origem ainda será definida)', () => {
    const store = useNotificationStore()

    expect(store.notifications).toEqual([])
    expect(store.count).toBe(0)
  })

  it('conta os alertas recebidos', () => {
    const store = useNotificationStore()

    store.notifications = [
      { id: 'n1', title: 'Fatura vence amanhã', description: 'Itaú Click', date: '2026-10-08' },
      { id: 'n2', title: 'Conta vencida', description: 'Conta de luz', date: '2026-10-05' },
    ]

    expect(store.count).toBe(2)
  })
})
