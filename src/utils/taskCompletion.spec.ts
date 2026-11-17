import { describe, expect, it } from 'vitest'

import type { Task } from '@/types/task'

import { deadlineState, fullPoints, latePoints, wouldBeLate } from './taskCompletion'

const BASE: Task = {
  id: '1',
  areaId: 'a',
  title: 'Pintar',
  day: '2026-11-18',
  time: null,
  estimateMinutes: 60,
  difficulty: 'DIFICIL',
  priority: 'ALTA',
  notes: null,
  sprintId: 'spr_1',
  done: false,
  completedAt: null,
  superTaskId: null,
  late: false,
  archived: false,
  archivedAt: null,
  createdAt: '',
}

describe('wouldBeLate', () => {
  it('sem hora: só atrasa depois do dia da tarefa', () => {
    expect(wouldBeLate(BASE, new Date(2026, 10, 18, 23, 59))).toBe(false)
    expect(wouldBeLate(BASE, new Date(2026, 10, 19, 0, 0))).toBe(true)
  })

  it('com hora: atrasa depois de início + tempo estimado (no limite exato não atrasa)', () => {
    const task = { ...BASE, time: '11:00' }
    expect(wouldBeLate(task, new Date(2026, 10, 18, 12, 0))).toBe(false)
    expect(wouldBeLate(task, new Date(2026, 10, 18, 12, 1))).toBe(true)
  })

  it('o prazo atravessa a meia-noite quando início + tempo passa de 24h', () => {
    const task = { ...BASE, time: '23:30' }
    expect(wouldBeLate(task, new Date(2026, 10, 19, 0, 30))).toBe(false)
    expect(wouldBeLate(task, new Date(2026, 10, 19, 0, 31))).toBe(true)
  })

  it('sem dia não há prazo', () => {
    expect(wouldBeLate({ ...BASE, day: null }, new Date(2030, 0, 1))).toBe(false)
  })
})

describe('pontos', () => {
  it('cheios e reduzidos a 20% (arredondado)', () => {
    expect(fullPoints(BASE)).toBe(15)
    expect(latePoints(BASE)).toBe(3)
  })

  it('sem tempo, dificuldade ou prioridade não há pontos', () => {
    expect(fullPoints({ ...BASE, difficulty: null })).toBeNull()
    expect(latePoints({ ...BASE, priority: null })).toBeNull()
  })
})

describe('deadlineState', () => {
  const now = new Date(2026, 10, 19, 10, 0)

  it('pendente: no prazo ou atrasada', () => {
    expect(deadlineState(BASE, new Date(2026, 10, 18, 10, 0))).toBe('on-time')
    expect(deadlineState(BASE, now)).toBe('overdue')
  })

  it('concluída: usa o `late` do backend, não o relógio', () => {
    expect(deadlineState({ ...BASE, done: true, late: false }, now)).toBe('done')
    expect(deadlineState({ ...BASE, done: true, late: true }, now)).toBe('done-late')
  })
})
