import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { areaService } from '@/services/areaService'
import { useAreaStore } from '@/stores/areaStore'
import type { Area } from '@/types/area'

vi.mock('@/services/areaService', () => ({
  areaService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))

const service = vi.mocked(areaService)

function area(id: string, overrides: Partial<Area> = {}): Area {
  return { id, name: `Área ${id}`, color: '#3b82f6', system: false, createdAt: '', ...overrides }
}

const ROUTINE = area('r', { name: 'Rotina', system: true })

describe('areaStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('carrega as áreas e separa as criadas pelo usuário', async () => {
    service.list.mockResolvedValue([ROUTINE, area('a')])
    const store = useAreaStore()
    await store.load()

    expect(store.areas).toHaveLength(2)
    expect(store.customAreas.map((item) => item.id)).toEqual(['a'])
    expect(store.isEmpty).toBe(false)
  })

  it('fica vazio quando só existe a Rotina', async () => {
    service.list.mockResolvedValue([ROUTINE])
    const store = useAreaStore()
    await store.load()
    expect(store.isEmpty).toBe(true)
  })

  it('guarda o erro e esvazia a lista quando o carregamento falha', async () => {
    service.list.mockRejectedValue(new Error('x'))
    const store = useAreaStore()
    await store.load()
    expect(store.error).toBeTruthy()
    expect(store.areas).toEqual([])
  })

  it('cria, atualiza e exclui recarregando a lista', async () => {
    service.list.mockResolvedValue([ROUTINE])
    service.create.mockResolvedValue(area('a'))
    service.update.mockResolvedValue(area('a'))
    service.remove.mockResolvedValue(undefined)
    const store = useAreaStore()

    expect(await store.create({ name: 'A', color: '#3b82f6' })).toBe(true)
    expect(await store.update('a', { name: 'B', color: '#3b82f6' })).toBe(true)
    expect(await store.remove('a', { action: 'delete' })).toBe(true)
    expect(service.remove).toHaveBeenCalledWith('a', { action: 'delete' })
    expect(service.list).toHaveBeenCalledTimes(3)
  })

  it('devolve false e registra o erro quando salvar falha', async () => {
    service.create.mockRejectedValue(new Error('Já existe uma área com esse nome.'))
    const store = useAreaStore()

    expect(await store.create({ name: 'A', color: '#3b82f6' })).toBe(false)
    expect(store.error).toBeTruthy()
    expect(store.saving).toBe(false)
  })
})
