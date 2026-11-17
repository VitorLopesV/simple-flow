import { beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { areaService } from '@/services/areaService'
import { mockDb } from '@/services/mock'
import { taskService } from '@/services/taskService'
import type { TaskPayload } from '@/types/task'

function payload(areaId: string, title = 'Pintar a casa'): TaskPayload {
  return {
    areaId,
    title,
    day: null,
    time: null,
    estimateMinutes: null,
    difficulty: null,
    priority: null,
    notes: null,
  }
}

describe('taskService (mock)', () => {
  let areaId: string

  beforeEach(async () => {
    const db = await mockDb()
    db.areas.splice(1)
    db.tasks.splice(0)
    areaId = (await areaService.create({ name: 'Casa', color: '#3b82f6' })).id
  })

  it('cria só com o título e lista na área', async () => {
    const created = await taskService.create(payload(areaId, '  Pintar a casa  '))
    expect(created).toMatchObject({ title: 'Pintar a casa', archived: false, day: null, priority: null })
    expect(await taskService.list({ areaId })).toHaveLength(1)
  })

  it('barra título vazio e a Rotina como dona', async () => {
    await expect(taskService.create(payload(areaId, '   '))).rejects.toThrow('título')
    const [routine] = await areaService.list()
    await expect(taskService.create(payload(routine!.id))).rejects.toThrow('Rotina')
  })

  it('edita os campos sem mudar a área', async () => {
    const created = await taskService.create(payload(areaId))
    const updated = await taskService.update(created.id, {
      title: 'Pintar o quarto',
      day: '2026-12-01',
      time: '09:00',
      estimateMinutes: 120,
      difficulty: 'DIFICIL',
      priority: 'ALTA',
      notes: 'Comprar tinta',
    })
    expect(updated).toMatchObject({ areaId, title: 'Pintar o quarto', day: '2026-12-01', estimateMinutes: 120 })
  })

  it('move para outra área e recusa a Rotina', async () => {
    const other = await areaService.create({ name: 'Faculdade', color: '#ef4444' })
    const created = await taskService.create(payload(areaId))
    expect((await taskService.move(created.id, other.id)).areaId).toBe(other.id)

    const [routine] = await areaService.list()
    await expect(taskService.move(created.id, routine!.id)).rejects.toThrow('Rotina')
  })

  it('oculta arquivadas por padrão e as mostra com o filtro', async () => {
    const created = await taskService.create(payload(areaId))
    await taskService.archive(created.id)

    expect(await taskService.list()).toHaveLength(0)
    const all = await taskService.list({ includeArchived: true })
    expect(all[0]).toMatchObject({ archived: true })
    expect(all[0]!.archivedAt).not.toBeNull()

    await taskService.unarchive(created.id)
    expect(await taskService.list()).toHaveLength(1)
  })

  it('exclui e falha em tarefa inexistente', async () => {
    const created = await taskService.create(payload(areaId))
    await taskService.remove(created.id)
    expect(await taskService.list()).toHaveLength(0)
    await expect(taskService.remove(created.id)).rejects.toThrow('não encontrada')
  })

  describe('conclusão', () => {
    it('conclui de forma definitiva e idempotente', async () => {
      const created = await taskService.create(payload(areaId))
      const done = await taskService.complete(created.id)
      expect(done).toMatchObject({ done: true, late: false, completedAt: expect.any(String) })

      const again = await taskService.complete(created.id)
      expect(again.completedAt).toBe(done.completedAt)
    })

    it('tarefa concluída não pode ser editada, movida, arquivada nem excluída', async () => {
      const other = await areaService.create({ name: 'Faculdade', color: '#10b981' })
      const created = await taskService.create(payload(areaId))
      await taskService.complete(created.id)

      await expect(taskService.update(created.id, { ...payload(areaId), title: 'Outro' })).rejects.toThrow(
        'definitiva',
      )
      await expect(taskService.move(created.id, other.id)).rejects.toThrow('definitiva')
      await expect(taskService.archive(created.id)).rejects.toThrow('definitiva')
      await expect(taskService.remove(created.id)).rejects.toThrow('definitiva')
    })

    it('tarefa arquivada não pode ser concluída', async () => {
      const created = await taskService.create(payload(areaId))
      await taskService.archive(created.id)
      await expect(taskService.complete(created.id)).rejects.toThrow('arquivada')
    })
  })
})
