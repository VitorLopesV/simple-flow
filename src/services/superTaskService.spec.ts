import { beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { areaService } from '@/services/areaService'
import { mockDb } from '@/services/mock'
import { superTaskService } from '@/services/superTaskService'
import { taskService } from '@/services/taskService'
import type { TaskPayload } from '@/types/task'

function payload(areaId: string, title = 'Comprar tinta'): TaskPayload {
  return { areaId, title, day: null, time: null, estimateMinutes: null, difficulty: null, priority: null, notes: null }
}

describe('superTaskService (mock)', () => {
  let areaId: string
  let superId: string

  beforeEach(async () => {
    const db = await mockDb()
    db.areas.splice(1)
    db.tasks.splice(0)
    db.superTasks.splice(0)
    areaId = (await areaService.create({ name: 'Casa', color: '#3b82f6' })).id
    superId = (await superTaskService.create({ areaId, title: 'Reforma', notes: null, endDate: null })).id
  })

  async function child(title = 'Filha'): Promise<string> {
    const task = await taskService.create(payload(areaId, title))
    await superTaskService.addTask(superId, task.id)
    return task.id
  }

  async function current() {
    return (await superTaskService.list()).find((item) => item.id === superId)!
  }

  it('começa vazia: 0%, não iniciada e sem poder concluir', async () => {
    expect(await current()).toMatchObject({ progress: 0, state: 'NAO_INICIADA', totalTasks: 0, canComplete: false })
  })

  it('calcula o % arredondando para baixo e muda o estado', async () => {
    const [a] = [await child('a'), await child('b'), await child('c')]
    await taskService.complete(a)
    expect(await current()).toMatchObject({ progress: 33, completedTasks: 1, totalTasks: 3, state: 'EM_ANDAMENTO' })
  })

  it('conclui sozinha ao concluir a última filha e fica travada', async () => {
    const a = await child('a')
    const b = await child('b')
    await taskService.complete(a)
    expect((await current()).done).toBe(false)
    await taskService.complete(b)

    expect(await current()).toMatchObject({ done: true, state: 'CONCLUIDA', progress: 100 })
    await expect(superTaskService.update(superId, { title: 'x', notes: null, endDate: null })).rejects.toThrow('travada')
    await expect(superTaskService.addTask(superId, (await taskService.create(payload(areaId))).id)).rejects.toThrow('travada')
  })

  it('reabre sem reconcluir sozinha: fica em andamento e só conclui com 100% de novo', async () => {
    const a = await child('a')
    await taskService.complete(a)
    await superTaskService.reopen(superId)

    expect(await current()).toMatchObject({ done: false, state: 'EM_ANDAMENTO', progress: 100, canComplete: true })
    await superTaskService.complete(superId)
    expect((await current()).done).toBe(true)
  })

  it('só marca como concluída com todas as filhas concluídas', async () => {
    await child('a')
    await expect(superTaskService.complete(superId)).rejects.toThrow('100%')
  })

  it('conclui ao retirar a única filha que faltava', async () => {
    const a = await child('a')
    const b = await child('b')
    await taskService.complete(a)
    await superTaskService.removeTask(superId, b)
    expect((await current()).done).toBe(true)
  })

  it('destaca a Super task vencida só enquanto não concluída', async () => {
    await superTaskService.update(superId, { title: 'Reforma', notes: null, endDate: '2020-01-01' })
    expect((await current()).overdue).toBe(true)
    const a = await child('a')
    await taskService.complete(a)
    expect((await current()).overdue).toBe(false)
  })

  it('filha concluída não sai da Super task nem muda de área; a aberta só muda com a Super task', async () => {
    const done = await child('feita')
    const open = await child('aberta')
    await taskService.complete(done)

    await expect(superTaskService.removeTask(superId, done)).rejects.toThrow('concluída')
    await expect(taskService.move(open, areaId)).rejects.toThrow('Super task')
    const other = (await areaService.create({ name: 'Trabalho', color: '#3b82f6' })).id
    await expect(superTaskService.move(superId, other)).rejects.toThrow('concluída')
  })

  it('move a Super task com as filhas abertas', async () => {
    const open = await child('aberta')
    const other = (await areaService.create({ name: 'Trabalho', color: '#3b82f6' })).id
    await superTaskService.move(superId, other)
    expect((await taskService.list({ areaId: other })).map((task) => task.id)).toContain(open)
  })

  it('só aceita avulsa, aberta, não arquivada e da mesma área como filha', async () => {
    const other = (await areaService.create({ name: 'Trabalho', color: '#3b82f6' })).id
    const foreign = await taskService.create(payload(other))
    await expect(superTaskService.addTask(superId, foreign.id)).rejects.toThrow('mesma área')

    const archived = await taskService.create(payload(areaId))
    await taskService.archive(archived.id)
    await expect(superTaskService.addTask(superId, archived.id)).rejects.toThrow('arquivada')

    const done = await taskService.create(payload(areaId))
    await taskService.complete(done.id)
    await expect(superTaskService.addTask(superId, done.id)).rejects.toThrow('concluída')
  })

  it('filha arquivada ainda aberta segura o 100% até ser desarquivada ou retirada', async () => {
    const a = await child('a')
    const b = await child('b')
    await taskService.complete(a)
    await taskService.archive(b)

    expect(await current()).toMatchObject({ progress: 50, canComplete: false, done: false })
    await taskService.unarchive(b)
    await taskService.complete(b)
    expect((await current()).done).toBe(true)
  })

  describe('converter tarefa em Super task', () => {
    it('leva título, área e notas e apaga a tarefa original', async () => {
      const task = await taskService.create({ ...payload(areaId, 'Pintar'), notes: 'Branco' })
      const created = await superTaskService.convert(task.id, '2026-12-30')

      expect(created).toMatchObject({ title: 'Pintar', areaId, notes: 'Branco', endDate: '2026-12-30' })
      expect(await taskService.list({ areaId })).toHaveLength(0)
    })

    it('recusa tarefa no sprint, concluída ou que já é filha', async () => {
      const inSprint = await taskService.create(payload(areaId))
      const db = await mockDb()
      db.tasks.find((task) => task.id === inSprint.id)!.sprintId = 'spr_x'
      await expect(superTaskService.convert(inSprint.id)).rejects.toThrow('sprint')

      const done = await taskService.create(payload(areaId))
      await taskService.complete(done.id)
      await expect(superTaskService.convert(done.id)).rejects.toThrow('concluída')

      await expect(superTaskService.convert(await child('filha'))).rejects.toThrow('filha')
    })
  })

  describe('excluir', () => {
    it('solta as filhas, que continuam na área como avulsas', async () => {
      const a = await child('a')
      await superTaskService.remove(superId, 'release')
      expect(await superTaskService.list()).toHaveLength(0)
      expect((await taskService.list({ areaId })).find((task) => task.id === a)).toMatchObject({ superTaskId: null })
    })

    it('exclui as filhas junto', async () => {
      await child('a')
      await superTaskService.remove(superId, 'delete')
      expect(await taskService.list({ areaId })).toHaveLength(0)
    })

    it('recusa com filha no sprint aberto, nos dois modos', async () => {
      const a = await child('a')
      const db = await mockDb()
      db.tasks.find((task) => task.id === a)!.sprintId = 'spr_x'
      await expect(superTaskService.remove(superId, 'release')).rejects.toThrow('sprint')
      await expect(superTaskService.remove(superId, 'delete')).rejects.toThrow('sprint')
    })

    it('recusa excluir junto com filha concluída, mas permite soltar', async () => {
      const a = await child('a')
      await child('b')
      await taskService.complete(a)
      await expect(superTaskService.remove(superId, 'delete')).rejects.toThrow('concluída')
      await expect(superTaskService.remove(superId, 'release')).resolves.toBeUndefined()
    })
  })

  it('a Super task nunca vira tarefa: não aparece na lista de tarefas', async () => {
    await child('a')
    const tasks = await taskService.list()
    expect(tasks.every((task) => task.id !== superId)).toBe(true)
  })

  it('excluir a área leva as Super tasks junto, ou as move com as tarefas', async () => {
    const other = (await areaService.create({ name: 'Trabalho', color: '#3b82f6' })).id
    await areaService.remove(areaId, { action: 'move', targetAreaId: other })
    expect((await current()).areaId).toBe(other)

    await areaService.remove(other, { action: 'delete' })
    expect(await superTaskService.list()).toHaveLength(0)
  })
})
