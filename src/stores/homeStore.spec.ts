import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { homeService } from '@/services/homeService'
import { sprintService } from '@/services/sprintService'
import { taskService } from '@/services/taskService'
import { useHomeStore } from '@/stores/homeStore'
import type { HomeSummary } from '@/types/home'

vi.mock('@/services/homeService', () => ({ homeService: { summary: vi.fn() } }))
vi.mock('@/services/sprintService', () => ({ sprintService: { completeOccurrence: vi.fn() } }))
vi.mock('@/services/taskService', () => ({ taskService: { complete: vi.fn() } }))

const summaryMock = vi.mocked(homeService.summary)
const completeOccurrenceMock = vi.mocked(sprintService.completeOccurrence)
const completeTaskMock = vi.mocked(taskService.complete)

function homeSummary(overrides: Partial<HomeSummary> = {}): HomeSummary {
  return {
    today: '2026-11-18',
    weekend: false,
    week: { start: '2026-11-16', end: '2026-11-22' },
    mission: { total: 4, completed: 1, occurrences: [] },
    todayTasks: [],
    scoreboard: {
      sprintId: 'spr_1',
      startDate: '2026-11-16',
      endDate: '2026-11-20',
      closed: false,
      closedAt: null,
      total: 100,
      done: 40,
      percentage: 40,
      bonus: false,
      reward: null,
    },
    weekBills: { total: 0, count: 0, bills: [] },
    finances: {
      referenceMonth: '2026-11',
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      totalInvoices: 0,
      incomeChange: 0,
      expenseChange: 0,
      incomeSeries: [],
      expenseSeries: [],
    },
    reminders: [],
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('homeStore', () => {
  it('carrega o resumo e calcula o progresso da missão', async () => {
    summaryMock.mockResolvedValue(homeSummary())
    const store = useHomeStore()

    await store.load()

    expect(store.summary?.today).toBe('2026-11-18')
    expect(store.missionProgress).toBe(25)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('progresso é zero sem itens na missão', async () => {
    summaryMock.mockResolvedValue(homeSummary({ mission: { total: 0, completed: 0, occurrences: [] } }))
    const store = useHomeStore()

    await store.load()

    expect(store.missionProgress).toBe(0)
  })

  it('falha ao carregar: guarda a mensagem em pt-BR', async () => {
    summaryMock.mockRejectedValue(new Error('x'))
    const store = useHomeStore()

    await store.load()

    expect(store.summary).toBeNull()
    expect(store.error).toBeTruthy()
    expect(store.loading).toBe(false)
  })

  it('ignora a resposta de uma carga antiga', async () => {
    let resolveFirst!: (value: HomeSummary) => void
    summaryMock.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
    summaryMock.mockResolvedValueOnce(homeSummary({ today: '2026-11-19' }))
    const store = useHomeStore()

    const first = store.load()
    await store.load()
    resolveFirst(homeSummary({ today: '2026-11-18' }))
    await first

    expect(store.summary?.today).toBe('2026-11-19')
  })

  it('concluir tarefa chama o service e recarrega o resumo', async () => {
    summaryMock.mockResolvedValue(homeSummary())
    completeTaskMock.mockResolvedValue({} as never)
    const store = useHomeStore()

    const ok = await store.completeTask('t1')

    expect(ok).toBe(true)
    expect(completeTaskMock).toHaveBeenCalledWith('t1')
    expect(summaryMock).toHaveBeenCalledTimes(1)
    expect(store.saving).toBe(false)
  })

  it('concluir ocorrência (rotina ou lembrete) usa a rota de ocorrências', async () => {
    summaryMock.mockResolvedValue(homeSummary())
    completeOccurrenceMock.mockResolvedValue({} as never)
    const store = useHomeStore()

    expect(await store.completeOccurrence('ocr_1')).toBe(true)
    expect(completeOccurrenceMock).toHaveBeenCalledWith('ocr_1')
  })

  it('falha ao concluir: devolve false, guarda o erro e não recarrega', async () => {
    completeTaskMock.mockRejectedValue(new Error('x'))
    const store = useHomeStore()

    expect(await store.completeTask('t1')).toBe(false)
    expect(store.error).toBeTruthy()
    expect(store.saving).toBe(false)
    expect(summaryMock).not.toHaveBeenCalled()
  })

  it('reset esquece o resumo', async () => {
    summaryMock.mockResolvedValue(homeSummary())
    const store = useHomeStore()
    await store.load()

    store.reset()

    expect(store.summary).toBeNull()
  })
})
