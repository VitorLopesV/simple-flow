import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { superTaskService } from '@/services/superTaskService'
import { taskService } from '@/services/taskService'
import { useSuperTaskStore } from '@/stores/superTaskStore'
import type { SuperTask } from '@/types/superTask'

vi.mock('@/services/superTaskService', () => ({
  superTaskService: {
    list: vi.fn(),
    create: vi.fn(),
    convert: vi.fn(),
    update: vi.fn(),
    move: vi.fn(),
    addTask: vi.fn(),
    removeTask: vi.fn(),
    complete: vi.fn(),
    reopen: vi.fn(),
    remove: vi.fn(),
  },
}))
vi.mock('@/services/taskService', () => ({ taskService: { create: vi.fn(), remove: vi.fn() } }))

const service = vi.mocked(superTaskService)

function superTask(id: string, areaId = 'a'): SuperTask {
  return {
    id,
    areaId,
    title: `Super ${id}`,
    notes: null,
    endDate: null,
    completedAt: null,
    done: false,
    archived: false,
    archivedAt: null,
    createdAt: '',
    tasks: [],
    totalTasks: 0,
    completedTasks: 0,
    progress: 0,
    state: 'NAO_INICIADA',
    overdue: false,
    canComplete: false,
  }
}

const TASK = {
  areaId: 'a',
  title: 'Filha',
  day: null,
  time: null,
  estimateMinutes: null,
  difficulty: null,
  priority: null,
  notes: null,
}

describe('superTaskStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('carrega, agrupa por área e indexa o nome por id', async () => {
    service.list.mockResolvedValue([superTask('1'), superTask('2', 'b')])
    const store = useSuperTaskStore()
    await store.load()

    expect(store.byArea('a').map((item) => item.id)).toEqual(['1'])
    expect(store.namesById).toEqual({ 1: 'Super 1', 2: 'Super 2' })
  })

  it('mutação recarrega a lista e devolve true; falha devolve false com a mensagem', async () => {
    service.list.mockResolvedValue([])
    service.reopen.mockResolvedValue(superTask('1'))
    const store = useSuperTaskStore()

    expect(await store.reopen('1')).toBe(true)
    expect(service.list).toHaveBeenCalledTimes(1)

    service.complete.mockRejectedValue(new Error('Só dá para marcar como concluída com 100%.'))
    expect(await store.complete('1')).toBe(false)
    expect(store.error).toContain('100%')
  })

  it('cria a filha e a coloca na Super task', async () => {
    service.list.mockResolvedValue([])
    vi.mocked(taskService.create).mockResolvedValue({ id: 't1' } as never)
    service.addTask.mockResolvedValue(superTask('1'))
    const store = useSuperTaskStore()

    expect(await store.createChild('1', TASK)).toBe(true)
    expect(service.addTask).toHaveBeenCalledWith('1', 't1')
  })

  it('desfaz a criação da filha quando a Super task recusa (ex.: travada)', async () => {
    vi.mocked(taskService.create).mockResolvedValue({ id: 't1' } as never)
    vi.mocked(taskService.remove).mockResolvedValue(undefined)
    service.addTask.mockRejectedValue(new Error('Super task concluída está travada.'))
    const store = useSuperTaskStore()

    expect(await store.createChild('1', TASK)).toBe(false)
    expect(taskService.remove).toHaveBeenCalledWith('t1')
    expect(store.error).toContain('travada')
  })
})
