import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sprintService } from '@/services/sprintService'
import { useSprintHistoryStore } from '@/stores/sprintHistoryStore'
import type { Paginated } from '@/types/common'
import type { SprintHistoryEntry } from '@/types/sprint'

vi.mock('@/services/sprintService', () => ({ sprintService: { listHistory: vi.fn() } }))

const service = vi.mocked(sprintService)

function entry(id: string): SprintHistoryEntry {
  return {
    sprintId: id,
    startDate: '2026-11-09',
    endDate: '2026-11-13',
    closedAt: '',
    total: 100,
    done: 90,
    percentage: 90,
    bonus: true,
    reward: null,
    rewardEarned: false,
    routine: { daysWithRoutine: 0, daysCompleted: 0, pointsPerDay: 40, total: 0, done: 0, days: [] },
    tasks: { count: 0, completed: 0, total: 0, done: 0, late: 0, notCompleted: 0, items: [] },
  }
}

function page(items: SprintHistoryEntry[], overrides: Partial<Paginated<SprintHistoryEntry>> = {}) {
  return { items, page: 1, pageSize: 10, total: items.length, totalPages: items.length ? 1 : 0, ...overrides }
}

describe('sprintHistoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('carrega a primeira página', async () => {
    service.listHistory.mockResolvedValue(page([entry('a')]))
    const store = useSprintHistoryStore()
    await store.load(1)
    expect(service.listHistory).toHaveBeenCalledWith({ page: 1, pageSize: 10 })
    expect(store.items).toHaveLength(1)
    expect(store.loaded).toBe(true)
    expect(store.isEmpty).toBe(false)
    expect(store.loading).toBe(false)
  })

  it('estado vazio (totalPages 0) não é erro', async () => {
    service.listHistory.mockResolvedValue(page([]))
    const store = useSprintHistoryStore()
    await store.load(1)
    expect(store.isEmpty).toBe(true)
    expect(store.totalPages).toBe(0)
    expect(store.error).toBeNull()
  })

  it('guarda a mensagem de erro e não marca vazio', async () => {
    service.listHistory.mockRejectedValue(new Error('falhou'))
    const store = useSprintHistoryStore()
    await store.load(1)
    expect(store.error).toBeTruthy()
    expect(store.isEmpty).toBe(false)
    expect(store.items).toEqual([])
  })

  it('página fora do intervalo que dá erro volta para a primeira', async () => {
    service.listHistory.mockRejectedValueOnce(new Error('fora')).mockResolvedValueOnce(page([entry('a')]))
    const store = useSprintHistoryStore()
    await store.goTo(7)
    expect(service.listHistory).toHaveBeenNthCalledWith(2, { page: 1, pageSize: 10 })
    expect(store.error).toBeNull()
    expect(store.items).toHaveLength(1)
  })

  it('página vazia com total > 0 vai para a última página', async () => {
    service.listHistory
      .mockResolvedValueOnce(page([], { page: 9, total: 12, totalPages: 2 }))
      .mockResolvedValueOnce(page([entry('b')], { page: 2, total: 12, totalPages: 2 }))
    const store = useSprintHistoryStore()
    await store.goTo(9)
    expect(service.listHistory).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 10 })
    expect(store.page).toBe(2)
  })

  it('não entra em loop se a primeira página também falha', async () => {
    service.listHistory.mockRejectedValue(new Error('fora'))
    const store = useSprintHistoryStore()
    await store.goTo(3)
    expect(service.listHistory).toHaveBeenCalledTimes(2)
    expect(store.error).toBeTruthy()
  })
})
