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

  it('recusa a Rotina como destino das tarefas', async () => {
    const [routine] = await areaService.list()
    const created = await areaService.create(PAYLOAD)
    await expect(
      areaService.remove(created.id, { action: 'move', targetAreaId: routine!.id }),
    ).rejects.toThrow('não aceita tarefas')
  })

  it('exclui a área e valida o destino ao mover as tarefas', async () => {
    const created = await areaService.create(PAYLOAD)
    await expect(
      areaService.remove(created.id, { action: 'move', targetAreaId: 'nope' }),
    ).rejects.toThrow('destino')

    await areaService.remove(created.id, { action: 'delete' })
    expect((await areaService.list()).map((area) => area.id)).not.toContain(created.id)
  })

  it('move ou exclui as tarefas da área junto com ela', async () => {
    const db = await mockDb()
    const from = await areaService.create(PAYLOAD)
    const to = await areaService.create({ ...PAYLOAD, name: 'Faculdade' })
    db.tasks.push({
      id: 't1',
      areaId: from.id,
      title: 't1',
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
    })

    await expect(areaService.remove(from.id)).rejects.toThrow('tem tarefas')
    await areaService.remove(from.id, { action: 'move', targetAreaId: to.id })
    expect(db.tasks.find((task) => task.id === 't1')?.areaId).toBe(to.id)

    await areaService.remove(to.id, { action: 'delete' })
    expect(db.tasks.some((task) => task.id === 't1')).toBe(false)
  })
})
