import { describe, expect, it } from 'vitest'

import type { Task } from './task'
import { isSprintReady, missingSprintFields } from './task'

const BASE: Task = {
  id: '1',
  areaId: 'a',
  title: 'Pintar',
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
  superTaskId: null,
  late: false,
  archivedAt: null,
  createdAt: '',
}

describe('prontidão para o sprint', () => {
  it('lista os campos que faltam', () => {
    expect(missingSprintFields(BASE)).toEqual(['dia', 'tempo', 'dificuldade', 'prioridade'])
    expect(isSprintReady(BASE)).toBe(false)
  })

  it('está pronta com dia, tempo, dificuldade e prioridade; hora é opcional', () => {
    const ready: Task = { ...BASE, day: '2026-12-01', estimateMinutes: 30, difficulty: 'FACIL', priority: 'BAIXA' }
    expect(missingSprintFields(ready)).toEqual([])
    expect(isSprintReady(ready)).toBe(true)
  })
})
