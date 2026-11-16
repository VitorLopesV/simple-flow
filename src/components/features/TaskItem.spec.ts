import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { Task } from '@/types/task'

import TaskItem from './TaskItem.vue'

const task: Task = {
  id: '1',
  areaId: 'a',
  title: 'Dentista',
  day: '2026-11-20',
  time: '09:00',
  estimateMinutes: 60,
  difficulty: null,
  priority: null,
  notes: null,
  archived: false,
  sprintId: null,
  archivedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
}

describe('TaskItem — Google Agenda', () => {
  it('mostra o link em nova aba com rel seguro quando há dia e hora', () => {
    const link = mount(TaskItem, { props: { task } }).find('[data-testid="add-to-calendar"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it.each([
    ['sem hora', { time: null }],
    ['sem dia', { day: null }],
    ['arquivada', { archived: true }],
  ])('não mostra o link %s', (_label, patch) => {
    const wrapper = mount(TaskItem, { props: { task: { ...task, ...patch } } })
    expect(wrapper.find('[data-testid="add-to-calendar"]').exists()).toBe(false)
  })
})
