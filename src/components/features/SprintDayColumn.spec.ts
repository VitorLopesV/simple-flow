import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SprintDayColumn from '@/components/features/SprintDayColumn.vue'
import SprintScoreboard from '@/components/features/SprintScoreboard.vue'
import type { SprintColumn } from '@/stores/sprintStore'
import type { Scoreboard } from '@/types/sprint'
import type { Task } from '@/types/task'

const TASK: Task = {
  id: 't1',
  areaId: 'a',
  title: 'Pintar a parede',
  day: '2026-11-18',
  time: '09:00',
  estimateMinutes: 120,
  difficulty: 'MEDIA',
  priority: 'ALTA',
  notes: null,
  sprintId: 'spr_1',
  archived: false,
  done: false,
  completedAt: null,
  superTaskId: null,
  late: false,
  archivedAt: null,
  createdAt: '',
}

function column(overrides: Partial<SprintColumn> = {}): SprintColumn {
  return {
    date: '2026-11-18',
    label: 'Quarta-feira',
    short: 'Qua',
    isToday: false,
    locked: false,
    occurrences: [],
    tasks: [TASK],
    totalMinutes: 120,
    ...overrides,
  }
}

describe('SprintDayColumn', () => {
  it('mostra a soma do tempo estimado e as tarefas', () => {
    const wrapper = mount(SprintDayColumn, { props: { column: column() } })

    expect(wrapper.get('[data-testid="day-total"]').text()).toContain('2 h estimados')
    expect(wrapper.text()).toContain('Pintar a parede')
  })

  it('dia aberto permite mover, remover e adicionar', async () => {
    const wrapper = mount(SprintDayColumn, { props: { column: column() } })

    await wrapper.get('[aria-label="Mover Pintar a parede para outro dia"]').trigger('click')
    await wrapper.get('[aria-label="Remover Pintar a parede do sprint"]').trigger('click')
    await wrapper.findAll('button').at(-1)!.trigger('click')

    expect(wrapper.emitted('move')?.[0]).toEqual([TASK])
    expect(wrapper.emitted('remove')?.[0]).toEqual([TASK])
    expect(wrapper.emitted('add')).toHaveLength(1)
  })

  it('dia passado fica travado: indica somente leitura e não oferece mover, remover nem adicionar', () => {
    const wrapper = mount(SprintDayColumn, { props: { column: column({ locked: true }) } })

    expect(wrapper.find('[data-testid="locked-badge"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="locked-note"]').text()).toContain('somente leitura')
    expect(wrapper.find('[aria-label^="Mover"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="Remover"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Adicionar tarefa')
  })

  it('mostra a etiqueta da Super task e a missão do dia', () => {
    const wrapper = mount(SprintDayColumn, {
      props: {
        column: column({
          tasks: [{ ...TASK, superTaskId: 'sup_1' }],
          occurrences: [
            { id: 'o1', itemId: 'r', name: 'Treinar', date: '2026-11-18', time: '07:00', index: 0, order: 0, completedAt: null },
          ],
        }),
        superTaskNames: { sup_1: 'Reforma' },
      },
    })

    expect(wrapper.get('[data-testid="super-task-badge"]').text()).toContain('Reforma')
    expect(wrapper.get('[aria-label="Missão do dia"]').text()).toContain('Treinar')
  })
  it('checklist da rotina só fica habilitado hoje', async () => {
    const occurrence = { id: 'o1', itemId: 'r', name: 'Treinar', date: '2026-11-18', time: null, index: 0, order: 0, completedAt: null }
    const today = mount(SprintDayColumn, { props: { column: column({ isToday: true, occurrences: [occurrence] }) } })
    const other = mount(SprintDayColumn, { props: { column: column({ occurrences: [occurrence] }) } })

    const enabled = today.get('[data-testid="complete-occurrence"]')
    expect(enabled.attributes('disabled')).toBeUndefined()
    await enabled.trigger('click')
    expect(today.emitted('completeOccurrence')?.[0]).toEqual([occurrence])
    expect(other.get('[data-testid="complete-occurrence"]').attributes('disabled')).toBeDefined()
  })

  it('na prévia (ocorrência sem id) o checklist fica desabilitado, mesmo hoje', () => {
    const occurrence = { id: null, itemId: 'r', name: 'Treinar', date: '2026-11-18', time: null, index: 0, order: 0, completedAt: null }
    const wrapper = mount(SprintDayColumn, { props: { column: column({ isToday: true, occurrences: [occurrence] }) } })

    expect(wrapper.get('[data-testid="complete-occurrence"]').attributes('disabled')).toBeDefined()
  })

  it('rotina concluída perde o botão', () => {
    const occurrence = { id: 'o1', itemId: 'r', name: 'Treinar', date: '2026-11-18', time: null, index: 0, order: 0, completedAt: '2026-11-18T10:00:00Z' }
    const wrapper = mount(SprintDayColumn, { props: { column: column({ isToday: true, occurrences: [occurrence] }) } })

    expect(wrapper.find('[data-testid="complete-occurrence"]').exists()).toBe(false)
  })

  it('emite a conclusão da tarefa, inclusive em dia passado (onde só dá para concluir)', async () => {
    const wrapper = mount(SprintDayColumn, { props: { column: column({ locked: true }) } })

    await wrapper.get('[data-testid="complete-task"]').trigger('click')
    expect(wrapper.emitted('completeTask')?.[0]).toEqual([TASK])
    expect(wrapper.find('[aria-label^="Mover"]').exists()).toBe(false)
  })

  it('tarefa concluída fica só leitura, com pontos e sem ações', () => {
    const wrapper = mount(SprintDayColumn, {
      props: { column: column({ tasks: [{ ...TASK, done: true, completedAt: '2026-11-18T10:00:00Z' }] }) },
    })

    expect(wrapper.find('[data-testid="complete-task"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="Mover"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="Remover"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="deadline-done"]').text()).toContain('18 pts')
  })

  it('concluída com atraso mostra os pontos reduzidos (20%)', () => {
    const wrapper = mount(SprintDayColumn, {
      props: { column: column({ tasks: [{ ...TASK, done: true, late: true, completedAt: '2026-11-19T10:00:00Z' }] }) },
    })

    expect(wrapper.get('[data-testid="deadline-done-late"]').text()).toContain('4 pts (20%)')
  })

  it('pendente com prazo vencido avisa que vale 20% antes de concluir', () => {
    const wrapper = mount(SprintDayColumn, {
      props: { column: column({ tasks: [{ ...TASK, day: '2020-01-01' }] }) },
    })

    expect(wrapper.get('[data-testid="deadline-overdue"]').text()).toContain('20%')
  })
})

describe('SprintScoreboard', () => {
  const BASE: Scoreboard = {
    total: 5000,
    done: 4498,
    percentage: 90,
    bonus: false,
    routine: { daysWithRoutine: 5, daysCompleted: 5, pointsPerDay: 40, total: 200, done: 200 },
    tasks: { count: 10, completed: 9, total: 4800, done: 4298 },
  }

  it('usa o campo bonus, nunca o percentual arredondado (89,96% exibe 90,0 mas sem selo)', () => {
    const wrapper = mount(SprintScoreboard, { props: { scoreboard: BASE } })

    expect(wrapper.get('[data-testid="scoreboard-percentage"]').text()).toBe('90,0%')
    expect(wrapper.find('[data-testid="bonus-badge"]').exists()).toBe(false)
  })

  it('mostra o selo quando bonus é verdadeiro', () => {
    const wrapper = mount(SprintScoreboard, { props: { scoreboard: { ...BASE, bonus: true } } })

    expect(wrapper.get('[data-testid="bonus-badge"]').text()).toContain('Bônus')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuetext')).toBe('4498 de 5000 pontos')
  })

  it('avisa que o sprint ainda não começou na prévia', () => {
    const wrapper = mount(SprintScoreboard, { props: { scoreboard: BASE, preview: true } })

    expect(wrapper.text()).toContain('ainda não começou')
  })
})
