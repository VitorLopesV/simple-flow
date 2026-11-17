import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sprintService } from '@/services/sprintService'
import { taskService } from '@/services/taskService'
import { useSprintStore } from '@/stores/sprintStore'
import type { SprintScoreboard, SprintView } from '@/types/sprint'
import type { Task } from '@/types/task'

vi.mock('@/services/sprintService', () => ({
  sprintService: {
    get: vi.fn(),
    getScoreboard: vi.fn(),
    listTasks: vi.fn(),
    addTask: vi.fn(),
    moveTask: vi.fn(),
    removeTask: vi.fn(),
    completeOccurrence: vi.fn(),
  },
}))

vi.mock('@/services/taskService', () => ({ taskService: { complete: vi.fn() } }))

const service = vi.mocked(sprintService)

const VIEW: SprintView = {
  sprint: {
    id: 'spr_1',
    startDate: '2026-11-16',
    endDate: '2026-11-20',
    status: 'ABERTO',
    startedRoutineAt: null,
    createdAt: '',
  },
  started: true,
  preview: false,
  occurrences: [
    { id: 'o1', itemId: 'r1', name: 'Treinar', date: '2026-11-18', time: null, index: 0, order: 0, completedAt: null },
  ],
  reminders: [],
}

const SCOREBOARD: SprintScoreboard = {
  sprintId: 'spr_1',
  startDate: '2026-11-16',
  endDate: '2026-11-20',
  started: true,
  preview: false,
  scoreboard: {
    total: 0,
    done: 0,
    percentage: 0,
    bonus: false,
    routine: { daysWithRoutine: 0, daysCompleted: 0, pointsPerDay: 40, total: 0, done: 0 },
    tasks: { count: 0, completed: 0, total: 0, done: 0 },
  },
}

function task(id: string, day: string, time: string | null, minutes: 15 | 60): Task {
  return {
    id,
    areaId: 'a',
    title: `Tarefa ${id}`,
    day,
    time,
    estimateMinutes: minutes,
    difficulty: 'FACIL',
    priority: 'BAIXA',
    notes: null,
    sprintId: 'spr_1',
    archived: false,
    done: false,
    completedAt: null,
    late: false,
    archivedAt: null,
    createdAt: '',
  }
}

describe('sprintStore', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 18, 12, 0, 0))
    setActivePinia(createPinia())
    vi.resetAllMocks()
    service.get.mockResolvedValue(VIEW)
    service.getScoreboard.mockResolvedValue(SCOREBOARD)
    service.listTasks.mockResolvedValue([
      task('1', '2026-11-18', '10:00', 60),
      task('2', '2026-11-18', null, 15),
      task('3', '2026-11-17', null, 60),
    ])
  })

  afterEach(() => vi.useRealTimers())

  it('monta as colunas seg–sex com missão, tarefas por hora e soma do tempo', async () => {
    const store = useSprintStore()
    await store.load()

    expect(store.columns.map((column) => column.date)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ])
    const wednesday = store.columns[2]!
    expect(wednesday.occurrences.map((entry) => entry.name)).toEqual(['Treinar'])
    // Sem hora primeiro, depois por horário.
    expect(wednesday.tasks.map((item) => item.id)).toEqual(['2', '1'])
    expect(wednesday.totalMinutes).toBe(75)
    expect(store.columns[1]!.totalMinutes).toBe(60)
  })

  it('trava os dias passados e só oferece hoje e futuros como destino', async () => {
    const store = useSprintStore()
    await store.load()

    expect(store.columns.map((column) => column.locked)).toEqual([true, true, false, false, false])
    expect(store.openDays.map((column) => column.date)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20'])
  })

  it('alterna para o próximo sprint', async () => {
    const store = useSprintStore()
    await store.select('next')

    expect(service.get).toHaveBeenCalledWith('next')
    expect(store.which).toBe('next')
  })

  it('expõe a mensagem do erro ao carregar', async () => {
    service.get.mockRejectedValue(new Error('falhou'))
    const store = useSprintStore()
    await store.load()

    expect(store.error).toBe('falhou')
    expect(store.columns).toEqual([])
  })

  it('adiciona, move e remove recarregando o sprint; em erro devolve false com a mensagem', async () => {
    const store = useSprintStore()
    service.addTask.mockResolvedValue(task('1', '2026-11-18', null, 15))
    expect(await store.addTask('1', '2026-11-18')).toBe(true)
    expect(service.addTask).toHaveBeenCalledWith('1', '2026-11-18')
    expect(service.get).toHaveBeenCalledTimes(1)

    service.moveTask.mockRejectedValue(new Error('Esse dia já passou.'))
    expect(await store.moveTask('1', '2026-11-17')).toBe(false)
    expect(store.error).toBe('Esse dia já passou.')

    service.removeTask.mockResolvedValue(task('1', '2026-11-18', null, 15))
    expect(await store.removeTask('1')).toBe(true)
  })

  it('concluir tarefa ou rotina recarrega sprint e placar', async () => {
    const store = useSprintStore()
    await store.load()
    vi.mocked(taskService.complete).mockResolvedValue(task('1', '2026-11-18', null, 15))
    service.completeOccurrence.mockResolvedValue(VIEW.occurrences[0]!)

    expect(await store.completeTask('1')).toBe(true)
    expect(await store.completeOccurrence('ocr_1')).toBe(true)
    expect(taskService.complete).toHaveBeenCalledWith('1')
    expect(service.completeOccurrence).toHaveBeenCalledWith('ocr_1')
    // Uma carga inicial + uma por conclusão: o placar vem sempre do servidor.
    expect(service.getScoreboard).toHaveBeenCalledTimes(3)
  })

  it('falha ao concluir devolve false e guarda a mensagem', async () => {
    const store = useSprintStore()
    service.completeOccurrence.mockRejectedValue(new Error('A rotina só pode ser concluída no próprio dia.'))

    expect(await store.completeOccurrence('ocr_1')).toBe(false)
    expect(store.error).toBe('A rotina só pode ser concluída no próprio dia.')
  })
})
