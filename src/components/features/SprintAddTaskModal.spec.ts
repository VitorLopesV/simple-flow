import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SprintAddTaskModal from '@/components/features/SprintAddTaskModal.vue'
import type { SprintColumn } from '@/stores/sprintStore'
import type { Area } from '@/types/area'
import type { Task } from '@/types/task'

const AREAS: Area[] = [
  { id: 'rot', name: 'Rotina', color: '#111', system: true, createdAt: '' },
  { id: 'trab', name: 'Trabalho', color: '#222', system: false, createdAt: '' },
]

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    areaId: 'trab',
    title: `Tarefa ${id}`,
    day: null,
    time: null,
    estimateMinutes: 60,
    difficulty: 'FACIL',
    priority: 'BAIXA',
    notes: null,
    sprintId: null,
    archived: false,
    done: false,
    completedAt: null,
    superTaskId: null,
    late: false,
    archivedAt: null,
    createdAt: '',
    ...overrides,
  }
}

const DAYS: SprintColumn[] = ['2026-11-18', '2026-11-19'].map((date, index) => ({
  date,
  label: index === 0 ? 'Quarta-feira' : 'Quinta-feira',
  short: index === 0 ? 'Qua' : 'Qui',
  isToday: index === 0,
  locked: false,
  occurrences: [],
  tasks: [],
  totalMinutes: 0,
}))

function mountModal(tasks: Task[]) {
  return mount(SprintAddTaskModal, {
    props: { open: true, areas: AREAS, tasks, days: DAYS, initialDay: '2026-11-19' },
    global: { stubs: { teleport: true } },
  })
}

describe('SprintAddTaskModal', () => {
  it('lista as áreas com as tarefas do backlog, sem as que já estão no sprint ou arquivadas', () => {
    const wrapper = mountModal([task('1'), task('2', { sprintId: 'spr' }), task('3', { archived: true })])

    expect(wrapper.text()).toContain('Trabalho')
    expect(wrapper.find('[data-testid="backlog-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="backlog-2"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="backlog-3"]').exists()).toBe(false)
  })

  it('tarefa sem campos obrigatórios mostra o que falta e não pode entrar', () => {
    const wrapper = mountModal([task('1', { estimateMinutes: null, priority: null })])

    expect(wrapper.get('[data-testid="missing-fields"]').text()).toContain('tempo, prioridade')
    expect(wrapper.get('[aria-label="Adicionar Tarefa 1 ao sprint"]').attributes('disabled')).toBeDefined()
  })

  it('emite a tarefa com o dia da coluna em que o modal foi aberto', async () => {
    const wrapper = mountModal([task('1')])
    await wrapper.get('[aria-label="Adicionar Tarefa 1 ao sprint"]').trigger('click')

    expect(wrapper.emitted('add')?.[0]).toEqual(['1', '2026-11-19'])
  })

  it('avisa quando o backlog está vazio', () => {
    expect(mountModal([]).find('[data-testid="no-backlog"]').exists()).toBe(true)
  })

  it('destaca e põe primeiro as tarefas devolvidas pelo sprint anterior', () => {
    const wrapper = mountModal([task('1'), task('2', { notCompletedInSprintOf: '2026-11-09' })])

    const items = wrapper.findAll('[data-testid^="backlog-"]')
    expect(items.map((item) => item.attributes('data-testid'))).toEqual(['backlog-2', 'backlog-1'])
    expect(items[0]!.find('[data-testid="returned-badge"]').text()).toBe('Não concluída no sprint de 09/11')
    expect(items[1]!.find('[data-testid="returned-badge"]').exists()).toBe(false)
  })
})
