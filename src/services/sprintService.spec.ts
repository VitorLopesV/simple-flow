import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { mockDb } from '@/services/mock'
import { sprintService } from '@/services/sprintService'
import { taskService } from '@/services/taskService'
import type { Task } from '@/types/task'

// Quarta-feira: o sprint atual é 16–20/11/2026 e o próximo, 23–27/11.
const TODAY = new Date(2026, 10, 18, 12, 0, 0)
const CURRENT = 'spr_2026-11-16'
const NEXT = 'spr_2026-11-23'

function readyTask(id: string, day: string | null, overrides: Partial<Task> = {}): Task {
  return {
    id,
    areaId: 'are_x',
    title: `Tarefa ${id}`,
    day,
    time: null,
    estimateMinutes: 60,
    difficulty: 'DIFICIL',
    priority: 'ALTA',
    notes: null,
    sprintId: null,
    archived: false,
    done: false,
    completedAt: null,
    late: false,
    archivedAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('sprintService (mock)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
    const db = await mockDb()
    db.tasks.splice(0)
    db.routineItems.splice(0)
  })

  afterEach(() => vi.useRealTimers())

  it('devolve o sprint atual iniciado e o próximo como prévia', async () => {
    const current = await sprintService.get('current')
    expect(current.sprint).toMatchObject({ startDate: '2026-11-16', endDate: '2026-11-20' })
    expect(current).toMatchObject({ started: true, preview: false })

    const next = await sprintService.get('next')
    expect(next.sprint.startDate).toBe('2026-11-23')
    expect(next).toMatchObject({ started: false, preview: true })
  })

  it('gera as missões da rotina e deixa sáb/dom do "a cada N dias" como lembretes', async () => {
    const db = await mockDb()
    db.routineItems.push({
      id: 'rot_1',
      areaId: 'x',
      name: 'Treinar',
      repeat: { mode: 'A_CADA_N_DIAS', interval: 1, startDate: '2026-11-01' },
      times: [{ time: '07:00' }],
      createdAt: '',
    })

    const view = await sprintService.get('current')
    expect(view.occurrences.map((entry) => entry.date)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ])
    expect(view.reminders.map((entry) => entry.date)).toEqual(['2026-11-21', '2026-11-22'])
    // Na prévia nada é gravado: as ocorrências não têm id.
    expect((await sprintService.get('next')).occurrences.every((entry) => entry.id === null)).toBe(true)
  })

  it('placar: rotina 40 pts por dia útil e tarefas pela fórmula', async () => {
    const db = await mockDb()
    db.routineItems.push({
      id: 'rot_1',
      areaId: 'x',
      name: 'Treinar',
      repeat: { mode: 'DIAS_DA_SEMANA', days: [1, 3] },
      times: [{ time: null }],
      createdAt: '',
    })
    db.tasks.push(readyTask('t1', '2026-11-19'))
    await sprintService.addTask('t1', '2026-11-19')

    const { scoreboard } = await sprintService.getScoreboard('current')
    expect(scoreboard.routine).toMatchObject({ daysWithRoutine: 2, total: 80, done: 0 })
    expect(scoreboard.tasks).toMatchObject({ count: 1, total: 15, done: 0 })
    expect(scoreboard).toMatchObject({ total: 95, done: 0, percentage: 0, bonus: false })
  })

  it('bônus só com feitos*10 >= total*9', async () => {
    const db = await mockDb()
    // 10 tarefas de 15 pts: 9 concluídas = 135/150 (90%).
    for (let index = 1; index <= 10; index += 1) {
      db.tasks.push(readyTask(`t${index}`, '2026-11-19', { sprintId: CURRENT, done: index <= 9 }))
    }
    expect((await sprintService.getScoreboard('current')).scoreboard).toMatchObject({ total: 150, done: 135, bonus: true })

    db.tasks[8]!.done = false // 120/150 = 80%
    expect((await sprintService.getScoreboard('current')).scoreboard.bonus).toBe(false)
  })

  it('lista só as tarefas do sprint', async () => {
    const db = await mockDb()
    db.tasks.push(readyTask('t1', '2026-11-19', { sprintId: CURRENT }), readyTask('t2', '2026-11-19'))
    expect((await sprintService.listTasks(CURRENT)).map((task) => task.id)).toEqual(['t1'])
  })

  describe('adicionar', () => {
    it('entra no sprint do dia escolhido (atual ou próximo) e grava o dia', async () => {
      const db = await mockDb()
      db.tasks.push(readyTask('t1', null), readyTask('t2', null))

      expect(await sprintService.addTask('t1', '2026-11-18')).toMatchObject({ sprintId: CURRENT, day: '2026-11-18' })
      expect(await sprintService.addTask('t2', '2026-11-24')).toMatchObject({ sprintId: NEXT })
    })

    it('recusa o que falta, mostrando os campos', async () => {
      const db = await mockDb()
      db.tasks.push(readyTask('t1', null, { estimateMinutes: null, priority: null }))
      await expect(sprintService.addTask('t1', '2026-11-18')).rejects.toThrow(
        'Faltam para entrar no sprint: tempo, prioridade.',
      )
    })

    it('recusa fim de semana, dia passado, fora dos dois sprints, duplicada e arquivada', async () => {
      const db = await mockDb()
      db.tasks.push(readyTask('t1', null), readyTask('t2', null, { archived: true }))

      await expect(sprintService.addTask('t1', '2026-11-21')).rejects.toThrow('dias úteis')
      await expect(sprintService.addTask('t1', '2026-11-17')).rejects.toThrow('já passou')
      await expect(sprintService.addTask('t1', '2026-12-02')).rejects.toThrow('sprint atual ou no próximo')
      await expect(sprintService.addTask('t2', '2026-11-18')).rejects.toThrow('arquivada')
      await sprintService.addTask('t1', '2026-11-18')
      await expect(sprintService.addTask('t1', '2026-11-19')).rejects.toThrow('já está no sprint')
    })
  })

  describe('mover e remover', () => {
    it('move para outro dia, inclusive para o sprint seguinte', async () => {
      const db = await mockDb()
      db.tasks.push(readyTask('t1', '2026-11-18', { sprintId: CURRENT }))

      expect(await sprintService.moveTask('t1', '2026-11-19')).toMatchObject({ day: '2026-11-19' })
      expect(await sprintService.moveTask('t1', '2026-11-25')).toMatchObject({ sprintId: NEXT })
    })

    it('trava tarefa de dia passado: não move nem remove', async () => {
      const db = await mockDb()
      db.tasks.push(readyTask('t1', '2026-11-17', { sprintId: CURRENT }))

      await expect(sprintService.moveTask('t1', '2026-11-19')).rejects.toThrow('só pode ser concluída')
      await expect(sprintService.removeTask('t1')).rejects.toThrow('só pode ser concluída')
    })

    it('remove devolvendo ao backlog e mantendo o dia', async () => {
      const db = await mockDb()
      db.tasks.push(readyTask('t1', '2026-11-19', { sprintId: CURRENT }))

      expect(await sprintService.removeTask('t1')).toMatchObject({ sprintId: null, day: '2026-11-19' })
      await expect(sprintService.removeTask('t1')).rejects.toThrow('não está no sprint')
    })
  })
})

describe('sprintService (mock) — conclusão', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
    const db = await mockDb()
    db.tasks.splice(0)
    db.routineItems.splice(0)
    db.completedOccurrences.clear()
  })

  afterEach(() => vi.useRealTimers())

  function routineEveryDay(db: Awaited<ReturnType<typeof mockDb>>): void {
    db.routineItems.push({
      id: 'rot_1',
      areaId: 'x',
      name: 'Treinar',
      repeat: { mode: 'DIAS_DA_SEMANA', days: [1, 2, 3, 4, 5] },
      times: [{ time: null }],
      createdAt: '',
    })
  }

  it('rotina só pode ser concluída no próprio dia; antes e depois dá erro', async () => {
    const db = await mockDb()
    routineEveryDay(db)

    await expect(sprintService.completeOccurrence('ocr_rot_1_2026-11-17_0')).rejects.toThrow('próprio dia')
    await expect(sprintService.completeOccurrence('ocr_rot_1_2026-11-19_0')).rejects.toThrow('próprio dia')
    expect(await sprintService.completeOccurrence('ocr_rot_1_2026-11-18_0')).toMatchObject({
      date: '2026-11-18',
      completedAt: expect.any(String),
    })
  })

  it('conclusão da rotina é idempotente e entra na missão e no placar (40 pts por dia)', async () => {
    const db = await mockDb()
    routineEveryDay(db)

    const first = await sprintService.completeOccurrence('ocr_rot_1_2026-11-18_0')
    const again = await sprintService.completeOccurrence('ocr_rot_1_2026-11-18_0')
    expect(again.completedAt).toBe(first.completedAt)

    const view = await sprintService.get('current')
    expect(view.occurrences.filter((entry) => entry.completedAt)).toHaveLength(1)
    const { scoreboard } = await sprintService.getScoreboard('current')
    expect(scoreboard.routine).toMatchObject({ daysCompleted: 1, done: 40, total: 200 })
  })

  it('concluir tarefa no prazo vale os pontos cheios no placar', async () => {
    const db = await mockDb()
    db.tasks.push(readyTask('t1', '2026-11-19', { sprintId: CURRENT }))

    expect(await taskService.complete('t1')).toMatchObject({ done: true, late: false })

    const { scoreboard } = await sprintService.getScoreboard('current')
    expect(scoreboard.tasks).toMatchObject({ completed: 1, total: 15, done: 15 })
  })

  it('tarefa atrasada vale 20% nos feitos e mantém o total cheio', async () => {
    const db = await mockDb()
    // Sem hora, dia de ontem: concluir hoje é atraso.
    db.tasks.push(readyTask('t1', '2026-11-17', { sprintId: CURRENT }))

    expect(await taskService.complete('t1')).toMatchObject({ done: true, late: true })

    const { scoreboard } = await sprintService.getScoreboard('current')
    expect(scoreboard.tasks).toMatchObject({ completed: 1, total: 15, done: 3 })
    expect(scoreboard.bonus).toBe(false)
  })

  it('tarefa concluída não pode ser movida, removida nem adicionada ao sprint', async () => {
    const db = await mockDb()
    db.tasks.push(readyTask('t1', '2026-11-19', { sprintId: CURRENT }))
    await taskService.complete('t1')

    await expect(sprintService.moveTask('t1', '2026-11-20')).rejects.toThrow('definitiva')
    await expect(sprintService.removeTask('t1')).rejects.toThrow('definitiva')
    await expect(sprintService.addTask('t1', '2026-11-20')).rejects.toThrow('definitiva')
  })
})
