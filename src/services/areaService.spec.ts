import { beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { areaService } from '@/services/areaService'
import { mockDb } from '@/services/mock'

const PAYLOAD = { name: 'Trabalho', color: '#3b82f6' }

describe('areaService (mock)', () => {
  beforeEach(async () => {
    const db = await mockDb()
    db.areas.splice(1)
  })

  it('lista só com a Rotina no início', async () => {
    const areas = await areaService.list()
    expect(areas.map((area) => [area.name, area.system])).toEqual([['Rotina', true]])
  })

  it('lista a Rotina primeiro, depois em ordem alfabética', async () => {
    await areaService.create({ ...PAYLOAD, name: 'Pai' })
    await areaService.create(PAYLOAD)

    const names = (await areaService.list()).map((area) => area.name)
    expect(names).toEqual(['Rotina', 'Pai', 'Trabalho'])
  })

  it('barra nome repetido, inclusive Rotina', async () => {
    await areaService.create(PAYLOAD)
    await expect(areaService.create({ ...PAYLOAD, name: ' trabalho ' })).rejects.toThrow('Já existe')
    await expect(areaService.create({ ...PAYLOAD, name: 'ROTINA' })).rejects.toThrow('Já existe')
  })

  it('renomeia e muda a cor', async () => {
    const created = await areaService.create(PAYLOAD)
    const updated = await areaService.update(created.id, { name: 'Faculdade', color: '#ef4444' })
    expect(updated).toMatchObject({ id: created.id, name: 'Faculdade', color: '#ef4444' })
  })

  it('não edita nem exclui a Rotina', async () => {
    const [routine] = await areaService.list()
    await expect(areaService.update(routine!.id, PAYLOAD)).rejects.toThrow('Rotina')
    await expect(areaService.remove(routine!.id)).rejects.toThrow('Rotina')
  })

  it('exclui a área e valida o destino ao mover as tarefas', async () => {
    const created = await areaService.create(PAYLOAD)
    await expect(
      areaService.remove(created.id, { action: 'move', targetAreaId: 'nope' }),
    ).rejects.toThrow('destino')

    await areaService.remove(created.id, { action: 'delete' })
    expect((await areaService.list()).map((area) => area.id)).not.toContain(created.id)
  })
})
