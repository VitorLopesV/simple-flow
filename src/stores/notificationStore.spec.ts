import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notificationService } from '@/services/notificationService'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import type { AppNotification } from '@/types/notification'

vi.mock('@/services/notificationService', () => ({ notificationService: { list: vi.fn() } }))

const listMock = vi.mocked(notificationService.list)

const SEEN_KEY = 'simpleflow.seenAlerts.anonymous'

function alert(id: string): AppNotification {
  return { id, kind: 'TAREFA_ATRASADA', title: `Alerta ${id}`, description: 'Descrição', date: '2026-11-17' }
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  listMock.mockReset()
})

describe('notificationStore', () => {
  it('começa sem alertas', () => {
    const store = useNotificationStore()

    expect(store.notifications).toEqual([])
    expect(store.count).toBe(0)
    expect(store.unseenCount).toBe(0)
  })

  it('conta os alertas recebidos', () => {
    const store = useNotificationStore()

    store.notifications = [alert('n1'), alert('n2')]

    expect(store.count).toBe(2)
    expect(store.unseenCount).toBe(2)
  })

  it('carrega os alertas pelo service', async () => {
    listMock.mockResolvedValue([alert('a1'), alert('a2')])
    const store = useNotificationStore()

    await store.load()

    expect(store.notifications.map((item) => item.id)).toEqual(['a1', 'a2'])
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('falha ao carregar: guarda a mensagem e mantém os alertas que já tinha', async () => {
    listMock.mockResolvedValueOnce([alert('a1')])
    const store = useNotificationStore()
    await store.load()

    listMock.mockRejectedValueOnce(new Error('falhou'))
    await store.load()

    expect(store.error).toBeTruthy()
    expect(store.notifications).toHaveLength(1)
    expect(store.loading).toBe(false)
  })

  it('marcar como visto tira o alerta do contador e persiste os ids', async () => {
    listMock.mockResolvedValue([alert('a1'), alert('a2')])
    const store = useNotificationStore()
    await store.load()

    store.markSeen(['a1'])

    expect(store.unseenCount).toBe(1)
    expect(JSON.parse(localStorage.getItem(SEEN_KEY)!)).toEqual(['a1'])
  })

  it('um alerta visto não volta a contar quando a lista recarrega com o mesmo id', async () => {
    listMock.mockResolvedValue([alert('a1')])
    const store = useNotificationStore()
    await store.load()
    store.markSeen(['a1'])

    await store.load()

    expect(store.unseenCount).toBe(0)
  })

  it('alerta novo (id novo) conta de novo e os ids que sumiram saem da lista guardada', async () => {
    listMock.mockResolvedValueOnce([alert('a1')])
    const store = useNotificationStore()
    await store.load()
    store.markSeen(['a1'])

    listMock.mockResolvedValueOnce([alert('a2')])
    await store.load()

    expect(store.unseenCount).toBe(1)
    expect(store.seenIds).toEqual([])
    expect(JSON.parse(localStorage.getItem(SEEN_KEY)!)).toEqual([])
  })

  it('relê os ids vistos guardados no dispositivo', () => {
    localStorage.setItem(SEEN_KEY, JSON.stringify(['a1']))
    const store = useNotificationStore()

    store.notifications = [alert('a1'), alert('a2')]

    expect(store.unseenCount).toBe(1)
  })

  it('ignora um valor guardado que não é uma lista de ids', () => {
    localStorage.setItem(SEEN_KEY, '{ quebrado')

    expect(useNotificationStore().seenIds).toEqual([])
  })

  it('o "visto" é por usuário: outra conta na mesma aba relê os próprios ids', async () => {
    localStorage.setItem('simpleflow.seenAlerts.u2', JSON.stringify(['a1']))
    listMock.mockResolvedValue([alert('a1')])
    const store = useNotificationStore()
    await store.load()
    expect(store.unseenCount).toBe(1)

    useAuthStore().user = { id: 'u2', email: 'u2@x.com', name: 'U2' }
    await store.load()

    expect(store.unseenCount).toBe(0)
  })

  it('reset esquece alertas e vistos', async () => {
    listMock.mockResolvedValue([alert('a1')])
    const store = useNotificationStore()
    await store.load()
    store.markSeen(['a1'])

    store.reset()

    expect(store.notifications).toEqual([])
    expect(store.seenIds).toEqual([])
    expect(store.error).toBeNull()
  })
})
