import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { taskService } from '@/services/taskService'
import { useTaskStore } from '@/stores/taskStore'
import type { Task } from '@/types/task'

vi.mock('@/services/taskService', () => ({
  taskService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    move: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
    complete: vi.fn(),
    remove: vi.fn(),
  },
}))

const service = vi.mocked(taskService)

function task(id: string, areaId = 'a'): Task {
  return {
    id,
    areaId,
    title: `Tarefa ${id}`,
    day: null,
    time: null,
    estimateMinutes: null,
    difficulty: null,
    priority: null,
    notes: null,
    archived: false,
    sprintId: null,
    done: false,
    completedAt: null,
    late: false,
    archivedAt: null,
    createdAt: '',
  }
}

const EDIT = {
  title: 'x',
  day: null,
  time: null,
  estimateMinutes: null,
  difficulty: null,
  priority: null,
  notes: null,
}

describe('taskStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('carrega e agrupa por área', async () => {
    service.list.mockResolvedValue([task('1', 'a'), task('2', 'b'), task('3', 'a')])
    const store = useTaskStore()
    await store.load()

    expect(store.byArea('a').map((item) => item.id)).toEqual(['1', '3'])
    expect(store.byArea('b')).toHaveLength(1)
    expect(store.isEmpty).toBe(false)
    expect(service.list).toHaveBeenCalledWith({ includeArchived: false })
  })

  it('guarda o erro de carregamento e esvazia a lista', async () => {
    service.list.mockRejectedValue(new Error('x'))
    const store = useTaskStore()
    await store.load()

    expect(store.error).toBeTruthy()
    expect(store.tasks).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('recarrega incluindo arquivadas ao ligar o filtro', async () => {
    service.list.mockResolvedValue([])
    const store = useTaskStore()
    await store.setShowArchived(true)
    expect(service.list).toHaveBeenCalledWith({ includeArchived: true })
  })

  it('mutações recarregam a lista e retornam sucesso', async () => {
    service.list.mockResolvedValue([])
    service.create.mockResolvedValue(task('1'))
    service.update.mockResolvedValue(task('1'))
    service.move.mockResolvedValue(task('1'))
    service.archive.mockResolvedValue(task('1'))
    service.unarchive.mockResolvedValue(task('1'))
    service.complete.mockResolvedValue(task('1'))
    service.remove.mockResolvedValue(undefined)
    const store = useTaskStore()

    expect(await store.create({ ...EDIT, areaId: 'a' })).toBe(true)
    expect(await store.update('1', EDIT)).toBe(true)
    expect(await store.move('1', 'b')).toBe(true)
    expect(await store.archive('1')).toBe(true)
    expect(await store.unarchive('1')).toBe(true)
    expect(await store.complete('1')).toBe(true)
    expect(await store.remove('1')).toBe(true)
    expect(service.list).toHaveBeenCalledTimes(7)
  })

  it('retorna false e guarda o erro quando a mutação falha', async () => {
    service.archive.mockRejectedValue(new Error('x'))
    const store = useTaskStore()

    expect(await store.archive('1')).toBe(false)
    expect(store.error).toBeTruthy()
    expect(store.saving).toBe(false)
    expect(service.list).not.toHaveBeenCalled()
  })
})
