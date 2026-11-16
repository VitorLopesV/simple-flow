import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { routineService } from '@/services/routineService'
import { useRoutineStore } from '@/stores/routineStore'
import type { RoutineItem, RoutinePayload } from '@/types/routine'

vi.mock('@/services/routineService', () => ({
  routineService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))

const service = vi.mocked(routineService)

function item(id: string): RoutineItem {
  return {
    id,
    areaId: 'a',
    name: `Item ${id}`,
    repeat: { mode: 'DIAS_DA_SEMANA', days: [1] },
    times: [{ time: null }],
    createdAt: '',
  }
}

const PAYLOAD: RoutinePayload = {
  name: 'x',
  repeat: { mode: 'DIAS_DA_SEMANA', days: [1] },
  times: [{ time: null }],
}

describe('routineStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('carrega os itens', async () => {
    service.list.mockResolvedValue([item('1')])
    const store = useRoutineStore()
    await store.load()

    expect(store.items).toHaveLength(1)
    expect(store.isEmpty).toBe(false)
  })

  it('guarda a mensagem de erro e zera a lista se o carregamento falhar', async () => {
    service.list.mockRejectedValue(new Error('boom'))
    const store = useRoutineStore()
    await store.load()

    expect(store.items).toEqual([])
    expect(store.error).toBeTruthy()
  })

  it('cria, atualiza e remove recarregando a lista', async () => {
    service.list.mockResolvedValue([])
    service.create.mockResolvedValue(item('1'))
    service.update.mockResolvedValue(item('1'))
    service.remove.mockResolvedValue(undefined)
    const store = useRoutineStore()

    expect(await store.create(PAYLOAD)).toBe(true)
    expect(await store.update('1', PAYLOAD)).toBe(true)
    expect(await store.remove('1')).toBe(true)
    expect(service.create).toHaveBeenCalledWith(PAYLOAD)
    expect(service.update).toHaveBeenCalledWith('1', PAYLOAD)
    expect(service.list).toHaveBeenCalledTimes(3)
    expect(store.saving).toBe(false)
  })

  it('devolve false e guarda o erro quando a mutação falha', async () => {
    service.create.mockRejectedValue(new Error('Informe o nome do item.'))
    const store = useRoutineStore()

    expect(await store.create(PAYLOAD)).toBe(false)
    expect(store.error).toBeTruthy()
    expect(store.saving).toBe(false)
  })
})
