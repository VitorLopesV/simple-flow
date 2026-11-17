import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { homeService } from '@/services/homeService'
import { mockDb } from '@/services/mock'
import { sprintService } from '@/services/sprintService'
import type { Expense } from '@/types/expense'
import type { Task } from '@/types/task'

// Quarta-feira 18/11/2026, meio-dia: o sprint atual é 16–20/11.
const WEDNESDAY = new Date(2026, 10, 18, 12, 0, 0)
const SATURDAY = new Date(2026, 10, 21, 12, 0, 0)

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    areaId: 'are_x',
    title: `Tarefa ${id}`,
    day: '2026-11-18',
    time: null,
    estimateMinutes: 60,
    difficulty: 'DIFICIL',
    priority: 'ALTA',
    notes: null,
    sprintId: null,
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

function bill(id: string, dueDate: string, overrides: Partial<Expense> = {}): Expense {
  return {
    id,
    description: `Conta ${id}`,
    amount: 100,
    date: dueDate,
    categoryId: 'cat_x',
    type: 'CONTA',
    status: 'PENDENTE',
    dueDate,
    paymentMethod: 'BOLETO',
    recurring: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

const EVERY_DAY = { mode: 'A_CADA_N_DIAS', interval: 1, startDate: '2026-11-01' } as const

describe('homeService (mock)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(WEDNESDAY)
    const db = await mockDb()
    db.tasks.splice(0)
    db.routineItems.splice(0)
    db.expenses.splice(0)
    db.incomes.splice(0)
    db.invoices.splice(0)
    db.sprintRewards.clear()
    db.defaultReward.value = null
    db.completedOccurrences.clear()
  })

  afterEach(() => vi.useRealTimers())

  it('missão do dia: só as ocorrências de hoje, por hora e sem hora no fim', async () => {
    const db = await mockDb()
    db.routineItems.push(
      { id: 'r1', areaId: 'x', name: 'Sem hora', repeat: EVERY_DAY, times: [{ time: null }], createdAt: '' },
      { id: 'r2', areaId: 'x', name: 'Cedo', repeat: EVERY_DAY, times: [{ time: '07:00' }, { time: '21:00' }], createdAt: '' },
    )

    const home = await homeService.summary()

    expect(home.today).toBe('2026-11-18')
    expect(home.weekend).toBe(false)
    expect(home.week).toEqual({ start: '2026-11-16', end: '2026-11-22' })
    expect(home.mission.occurrences.map((entry) => entry.time)).toEqual(['07:00', '21:00', null])
    expect(home.mission).toMatchObject({ total: 3, completed: 0 })
    expect(home.mission.occurrences.every((entry) => entry.date === '2026-11-18')).toBe(true)
  })

  it('concluir uma ocorrência reflete na missão e no placar', async () => {
    const db = await mockDb()
    db.routineItems.push({ id: 'r1', areaId: 'x', name: 'Treinar', repeat: EVERY_DAY, times: [{ time: null }], createdAt: '' })

    const before = await homeService.summary()
    await sprintService.completeOccurrence(before.mission.occurrences[0]!.id!)
    const after = await homeService.summary()

    expect(after.mission).toMatchObject({ total: 1, completed: 1 })
    expect(after.mission.occurrences[0]!.done).toBe(true)
    expect(after.scoreboard.done).toBeGreaterThan(before.scoreboard.done)
  })

  it('tarefas de hoje: por hora, marcando as fora do sprint e as atrasadas', async () => {
    const db = await mockDb()
    db.tasks.push(
      task('t_tarde', { time: '18:00', sprintId: 'spr_2026-11-16' }),
      task('t_cedo', { time: '08:00', estimateMinutes: 15, sprintId: 'spr_2026-11-16' }),
      task('t_dia', { time: null }),
      task('t_outro_dia', { day: '2026-11-19' }),
      task('t_arquivada', { archived: true }),
    )

    const { todayTasks } = await homeService.summary()

    expect(todayTasks.map((item) => item.id)).toEqual(['t_cedo', 't_tarde', 't_dia'])
    expect(todayTasks.find((item) => item.id === 't_cedo')).toMatchObject({ inSprint: true, overdue: true })
    expect(todayTasks.find((item) => item.id === 't_tarde')).toMatchObject({ inSprint: true, overdue: false })
    // Sem hora, o prazo é o fim do dia: nunca atrasada durante o próprio dia.
    expect(todayTasks.find((item) => item.id === 't_dia')).toMatchObject({ inSprint: false, overdue: false })
  })

  it('contas da semana: pendentes com vencimento de segunda a domingo, vencidas marcadas', async () => {
    const db = await mockDb()
    db.expenses.push(
      bill('b_dom', '2026-11-22', { amount: 50.25 }),
      bill('b_seg', '2026-11-16', { amount: 10.1 }),
      bill('b_paga', '2026-11-17', { status: 'PAGO' }),
      bill('b_semana_que_vem', '2026-11-23'),
      bill('b_semana_passada', '2026-11-15'),
    )

    const { weekBills } = await homeService.summary()

    expect(weekBills.bills.map((item) => item.id)).toEqual(['b_seg', 'b_dom'])
    expect(weekBills.bills[0]).toMatchObject({ overdue: true, automatic: false })
    expect(weekBills.bills[1]!.overdue).toBe(false)
    expect(weekBills).toMatchObject({ count: 2, total: 60.35 })
  })

  it('sem contas na semana, devolve o total zerado', async () => {
    const { weekBills } = await homeService.summary()

    expect(weekBills).toEqual({ total: 0, count: 0, bills: [] })
  })

  it('finanças: competência do mês atual com saldo e fluxo', async () => {
    const db = await mockDb()
    db.incomes.push({
      id: 'i1',
      description: 'Salário',
      amount: 1000,
      date: '2026-11-05',
      categoryId: 'c',
      type: 'SALARIO',
      recurring: false,
      createdAt: '',
      updatedAt: '',
    })
    db.expenses.push(bill('e1', '2026-11-25', { amount: 300, date: '2026-11-10' }))

    const { finances } = await homeService.summary()

    expect(finances).toMatchObject({ referenceMonth: '2026-11', totalIncome: 1000, totalExpenses: 300, balance: 700 })
    expect(finances.incomeSeries).toHaveLength(6)
  })

  it('fim de semana: o sprint atual é o fechado, sem missão, com placar da foto e lembretes', async () => {
    vi.setSystemTime(SATURDAY)
    const db = await mockDb()
    db.routineItems.push({ id: 'r1', areaId: 'x', name: 'Ligar', repeat: EVERY_DAY, times: [{ time: '10:00' }], createdAt: '' })
    db.tasks.push(task('t_sab', { day: '2026-11-21' }))
    db.defaultReward.value = 'Cinema'

    const home = await homeService.summary()

    expect(home.weekend).toBe(true)
    expect(home.today).toBe('2026-11-21')
    expect(home.mission).toEqual({ total: 0, completed: 0, occurrences: [] })
    expect(home.scoreboard).toMatchObject({ closed: true, startDate: '2026-11-16', reward: 'Cinema' })
    expect(home.todayTasks.map((item) => item.id)).toEqual(['t_sab'])
    expect(home.todayTasks[0]!.inSprint).toBe(false)
    expect(home.reminders.map((item) => item.date)).toEqual(['2026-11-21', '2026-11-22'])
  })
})
