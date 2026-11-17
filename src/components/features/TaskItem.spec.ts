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
  done: false,
  completedAt: null,
  superTaskId: null,
  late: false,
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

describe('TaskItem — conclusão', () => {
  const ready: Task = { ...task, difficulty: 'DIFICIL', priority: 'ALTA', day: '2099-01-01', time: null }

  it('emite complete pelo botão Concluir', async () => {
    const wrapper = mount(TaskItem, { props: { task: ready } })

    await wrapper.get('[data-testid="complete-task"]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('tarefa concluída é só leitura: sem concluir, editar, mover, arquivar nem excluir', () => {
    const wrapper = mount(TaskItem, { props: { task: { ...ready, done: true, completedAt: '2026-11-18T10:00:00Z' } } })

    expect(wrapper.find('[data-testid="complete-task"]').exists()).toBe(false)
    // Só sobra o "transformar em Super task", visível porém desabilitado e explicado.
    expect(wrapper.findAll('button:not([disabled])')).toHaveLength(0)
    expect(wrapper.get('[data-testid="deadline-done"]').text()).toContain('15 pts')
  })

  it('concluída com atraso mostra os pontos reduzidos (20%)', () => {
    const wrapper = mount(TaskItem, { props: { task: { ...ready, done: true, late: true } } })

    expect(wrapper.get('[data-testid="deadline-done-late"]').text()).toContain('3 pts (20%)')
  })

  it('pendente com prazo vencido avisa dos 20% antes de concluir', () => {
    const wrapper = mount(TaskItem, { props: { task: { ...ready, day: '2020-01-01' } } })

    expect(wrapper.get('[data-testid="deadline-overdue"]').text()).toContain('3 de 15 pts')
  })

  it('pendente dentro do prazo não mostra aviso de atraso', () => {
    const wrapper = mount(TaskItem, { props: { task: ready } })

    expect(wrapper.find('[data-testid="deadline-overdue"]').exists()).toBe(false)
  })
})

describe('TaskItem — Super task', () => {
  it('avulsa oferece transformar em Super task', async () => {
    const wrapper = mount(TaskItem, { props: { task } })
    const button = wrapper.get('[data-testid="convert-task"]')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(wrapper.emitted('convert')).toHaveLength(1)
  })

  it.each([
    ['no sprint', { sprintId: 'spr_1' }, 'sprint'],
    ['concluída', { done: true }, 'concluída'],
  ])('transformar fica desabilitado e explicado quando a tarefa está %s', (_label, patch, reason) => {
    const wrapper = mount(TaskItem, { props: { task: { ...task, ...patch } } })
    const button = wrapper.get('[data-testid="convert-task"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toContain(reason)
    expect(wrapper.get(`#${button.attributes('aria-describedby')}`).text()).toContain(reason)
  })

  it('filha troca "transformar" por "retirar" e não oferece mover', () => {
    const wrapper = mount(TaskItem, { props: { task: { ...task, superTaskId: 'sup_1' }, inSuperTask: true } })
    expect(wrapper.find('[data-testid="convert-task"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="unlink-task"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="move-task"]').attributes('disabled')).toBeDefined()
  })
})
