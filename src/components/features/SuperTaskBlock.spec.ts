import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BaseProgressBar from '@/components/common/BaseProgressBar.vue'
import type { SuperTask } from '@/types/superTask'
import type { Task } from '@/types/task'

import SuperTaskBlock from './SuperTaskBlock.vue'
import SuperTaskDeleteDialog from './SuperTaskDeleteDialog.vue'

function task(id: string, patch: Partial<Task> = {}): Task {
  return {
    id,
    areaId: 'a',
    title: `Tarefa ${id}`,
    day: null,
    time: null,
    estimateMinutes: null,
    difficulty: null,
    priority: null,
    notes: null,
    sprintId: null,
    superTaskId: 'sup',
    done: false,
    completedAt: null,
    late: false,
    archived: false,
    archivedAt: null,
    createdAt: '',
    ...patch,
  }
}

function superTask(patch: Partial<SuperTask> = {}): SuperTask {
  return {
    id: 'sup',
    areaId: 'a',
    title: 'Reforma',
    notes: null,
    endDate: null,
    completedAt: null,
    done: false,
    archived: false,
    archivedAt: null,
    createdAt: '',
    tasks: [task('1', { done: true }), task('2')],
    totalTasks: 2,
    completedTasks: 1,
    progress: 50,
    state: 'EM_ANDAMENTO',
    overdue: false,
    canComplete: false,
    ...patch,
  }
}

const mountBlock = (patch: Partial<SuperTask> = {}, candidates: Task[] = []) =>
  mount(SuperTaskBlock, { props: { superTask: superTask(patch), candidates } })

describe('SuperTaskBlock', () => {
  it('mostra título, estado, % e "X de Y" com a barra acessível', () => {
    const wrapper = mountBlock()

    expect(wrapper.text()).toContain('Reforma')
    expect(wrapper.get('[data-testid="super-task-state"]').text()).toBe('Em andamento')
    expect(wrapper.get('[data-testid="super-task-progress-text"]').text()).toBe('50% · 1 de 2')
    const bar = wrapper.get('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('50')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
    expect(bar.attributes('aria-label')).toBe('Progresso de Reforma')
  })

  it('mostra cada estado derivado', () => {
    expect(mountBlock({ state: 'NAO_INICIADA', progress: 0, completedTasks: 0 }).get('[data-testid="super-task-state"]').text()).toBe('Não iniciada')
    expect(mountBlock({ state: 'CONCLUIDA', done: true, progress: 100 }).get('[data-testid="super-task-state"]').text()).toBe('Concluída')
  })

  it('expande e recolhe com aria-expanded', async () => {
    const wrapper = mountBlock()
    const toggle = wrapper.get('[data-testid="toggle-super-task"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it('destaca a Data de término vencida, só visualmente', () => {
    const overdue = mountBlock({ endDate: '2026-11-01', overdue: true })
    expect(overdue.get('[data-testid="super-task-end-date"]').text()).toContain('Vencida')
    const onTime = mountBlock({ endDate: '2026-12-01' })
    expect(onTime.get('[data-testid="super-task-end-date"]').text()).not.toContain('Vencida')
  })

  it('marcar como concluída fica desabilitado abaixo de 100%, com o motivo, e emite sem modal em 100%', async () => {
    const blocked = mountBlock()
    expect(blocked.get('[data-testid="complete-super-task"]').attributes('disabled')).toBeDefined()
    expect(blocked.get('[data-testid="super-task-reasons"]').text()).toContain('100%')

    const ready = mountBlock({ canComplete: true, progress: 100 })
    const button = ready.get('[data-testid="complete-super-task"]')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(ready.emitted('complete')).toHaveLength(1)
  })

  it('explica que filha arquivada aberta impede concluir', () => {
    const wrapper = mountBlock({ tasks: [task('1', { done: true }), task('2', { archived: true })] })
    expect(wrapper.get('[data-testid="super-task-reasons"]').text()).toContain('arquivada')
  })

  it('concluída fica travada: oferece desmarcar, sem editar nem adicionar filhas', async () => {
    const wrapper = mountBlock({ done: true, state: 'CONCLUIDA', progress: 100, completedTasks: 2, tasks: [task('1', { done: true })] })

    expect(wrapper.find('[data-testid="complete-super-task"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="edit-super-task"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="move-super-task"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input').exists()).toBe(false)
    await wrapper.get('[data-testid="reopen-super-task"]').trigger('click')
    expect(wrapper.emitted('reopen')).toHaveLength(1)
  })

  it('mover fica desabilitado e explicado com filha concluída ou no sprint', () => {
    const withDone = mountBlock()
    expect(withDone.get('[data-testid="move-super-task"]').attributes('disabled')).toBeDefined()
    expect(withDone.get('[data-testid="super-task-reasons"]').text()).toContain('filha concluída')

    const inSprint = mountBlock({ tasks: [task('2', { sprintId: 's' })] })
    expect(inSprint.get('[data-testid="super-task-reasons"]').text()).toContain('sprint')
  })

  it('filha concluída não pode ser retirada e a aberta não tem mover', () => {
    const wrapper = mountBlock()
    const done = wrapper.get('[data-testid="task-1"]')
    expect(done.get('[data-testid="unlink-task"]').attributes('disabled')).toBeDefined()
    const open = wrapper.get('[data-testid="task-2"]')
    expect(open.get('[data-testid="unlink-task"]').attributes('disabled')).toBeUndefined()
    expect(open.get('[data-testid="move-task"]').attributes('disabled')).toBeDefined()
  })

  it('cria filha pelo título e coloca tarefa avulsa', async () => {
    const wrapper = mountBlock({}, [task('9', { superTaskId: null, title: 'Avulsa' })])
    await wrapper.get('input').setValue('Comprar tinta')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('addChild')?.[0]).toEqual(['Comprar tinta'])

    await wrapper.get('select').setValue('9')
    await wrapper.findAll('form')[1]!.trigger('submit')
    expect(wrapper.emitted('addTask')?.[0]).toEqual(['9'])
  })
})

describe('SuperTaskDeleteDialog', () => {
  const mountDialog = (superTask: SuperTask) =>
    mount(SuperTaskDeleteDialog, {
      props: { superTask, open: true },
      attachTo: document.body,
      global: { stubs: { teleport: true } },
    })

  it('oferece soltar ou excluir junto e emite a escolha', async () => {
    const wrapper = mountDialog(superTask({ tasks: [task('2')] }))
    await wrapper.get('input[value="delete"]').setValue(true)
    await wrapper.get('[data-testid="confirm-delete-super-task"]').trigger('click')
    expect(wrapper.emitted('confirm')?.[0]).toEqual(['delete'])
    wrapper.unmount()
  })

  it('bloqueia com mensagem quando há filha no sprint aberto', () => {
    const wrapper = mountDialog(superTask({ tasks: [task('2', { sprintId: 's' })] }))
    expect(wrapper.get('[data-testid="delete-blocked"]').text()).toContain('sprint')
    expect(wrapper.get('[data-testid="confirm-delete-super-task"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('desabilita excluir junto com filha concluída, mas deixa soltar', () => {
    const wrapper = mountDialog(superTask())
    expect(wrapper.get('input[value="delete"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="confirm-delete-super-task"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('BaseProgressBar', () => {
  it('limita o valor a 0–100 e respeita prefers-reduced-motion', () => {
    const wrapper = mount(BaseProgressBar, { props: { value: 140, label: 'x' } })
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100')
    expect(wrapper.html()).toContain('motion-reduce:transition-none')
  })
})
