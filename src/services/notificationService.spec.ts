import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { mockDb } from '@/services/mock'
import { notificationService } from '@/services/notificationService'
import { sprintService } from '@/services/sprintService'
import type { Task } from '@/types/task'

const WEDNESDAY_NOON = new Date(2026, 10, 18, 12, 0, 0)
const EVERY_DAY = { mode: 'A_CADA_N_DIAS', interval: 1, startDate: '2026-11-01' } as const

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    areaId: 'are_x',
    title: `Tarefa ${id}`,
    day: '2026-11-17',
    time: null,
    estimateMinutes: 60,
    difficulty: 'DIFICIL',
    priority: 'ALTA',
    notes: null,
    sprintId: 'spr_2026-11-16',
    archived: false,
    done: false,
    completedAt: null,
    superTaskId: null,
    late: false,
    archivedAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('notificationService (mock)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(WEDNESDAY_NOON)
    const db = await mockDb()
    db.tasks.splice(0)
    db.routineItems.splice(0)
    db.completedOccurrences.clear()
    db.defaultReward.value = null
  })

  afterEach(() => vi.useRealTimers())

  it('sem nada atrasado, a lista vem vazia', async () => {
    expect(await notificationService.list()).toEqual([])
  })

  it('tarefa do sprint cujo prazo passou vira alerta com id estável; concluída ou no prazo não', async () => {
    const db = await mockDb()
    db.tasks.push(
      task('t1', { day: '2026-11-17' }),
      task('t_hoje', { day: '2026-11-18' }),
      task('t_feita', { day: '2026-11-17', done: true, completedAt: '2026-11-17T10:00:00.000Z' }),
    )

    const list = await notificationService.list()

    expect(list).toEqual([
      {
        id: 'tarefa-atrasada:t1:2026-11-17',
        kind: 'TAREFA_ATRASADA',
        title: 'Tarefa atrasada',
        description: '"Tarefa t1" venceu em 17/11. Concluir agora vale só 20% dos pontos.',
        date: '2026-11-17',
      },
    ])
    expect(await notificationService.list()).toEqual(list)
  })

  it('rotina incompleta só aparece a partir das 20h e some quando tudo é concluído', async () => {
    const db = await mockDb()
    db.routineItems.push({ id: 'r1', areaId: 'x', name: 'Treinar', repeat: EVERY_DAY, times: [{ time: null }], createdAt: '' })

    vi.setSystemTime(new Date(2026, 10, 18, 19, 59, 59))
    expect(await notificationService.list()).toEqual([])

    vi.setSystemTime(new Date(2026, 10, 18, 20, 0, 0))
    const [alert] = await notificationService.list()
    expect(alert).toMatchObject({ id: 'rotina-incompleta:2026-11-18', kind: 'ROTINA_INCOMPLETA', date: '2026-11-18' })
    expect(alert!.description).toBe('Você concluiu 0 de 1 itens da rotina. Cumpra a missão do dia para pontuar.')

    const { occurrences } = await sprintService.get('current')
    await sprintService.completeOccurrence(occurrences.find((entry) => entry.date === '2026-11-18')!.id!)
    expect(await notificationService.list()).toEqual([])
  })

  it('ordena por data decrescente e, no mesmo dia, rotina antes de tarefa', async () => {
    const db = await mockDb()
    db.routineItems.push({ id: 'r1', areaId: 'x', name: 'Treinar', repeat: EVERY_DAY, times: [{ time: null }], createdAt: '' })
    db.tasks.push(task('t_ontem', { day: '2026-11-17' }), task('t_hoje', { day: '2026-11-18', time: '08:00' }))
    vi.setSystemTime(new Date(2026, 10, 18, 21, 0, 0))

    const list = await notificationService.list()

    expect(list.map((item) => item.kind)).toEqual(['ROTINA_INCOMPLETA', 'TAREFA_ATRASADA', 'TAREFA_ATRASADA'])
    expect(list.map((item) => item.date)).toEqual(['2026-11-18', '2026-11-18', '2026-11-17'])
  })

  it('fim de semana: só o resultado do sprint fechado, sem alerta de tarefa nem de rotina', async () => {
    const db = await mockDb()
    db.tasks.push(task('t1', { day: '2026-11-17' }))
    db.defaultReward.value = 'Cinema'
    vi.setSystemTime(new Date(2026, 10, 21, 12, 0, 0))

    const list = await notificationService.list()

    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'resultado-sprint:spr_2026-11-16', kind: 'RESULTADO_SPRINT', date: '2026-11-20' })
    expect(list[0]!.title).toMatch(/^Bônus do sprint (não )?liberado$/)
  })
})
