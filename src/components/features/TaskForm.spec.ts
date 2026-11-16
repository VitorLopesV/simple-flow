import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import TaskForm from '@/components/features/TaskForm.vue'
import type { Task } from '@/types/task'

const TASK: Task = {
  id: '1',
  areaId: 'a',
  title: 'Pintar a casa',
  day: null,
  time: null,
  estimateMinutes: null,
  difficulty: null,
  priority: null,
  notes: null,
  archived: false,
  sprintId: null,
  archivedAt: null,
  createdAt: '',
}

/** A validação do vee-validate é assíncrona: espera o `save` ou um erro em vez de um atraso fixo. */
async function submit(wrapper: VueWrapper) {
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => {
    if (!wrapper.emitted('save') && !wrapper.find('[role="alert"]').exists()) throw new Error('validação pendente')
  })
  await flushPromises()
}

const chip = (wrapper: ReturnType<typeof mount>, label: string) =>
  wrapper.findAll('button[aria-pressed]').find((b) => b.text() === label)!

describe('TaskForm', () => {
  it('emite a edição com os botões rápidos escolhidos', async () => {
    const wrapper = mount(TaskForm, { props: { task: TASK } })
    await chip(wrapper, '1 h').trigger('click')
    await chip(wrapper, 'Difícil').trigger('click')
    await chip(wrapper, 'Alta').trigger('click')
    await submit(wrapper)

    expect(wrapper.emitted('save')?.[0]).toEqual([
      {
        title: 'Pintar a casa',
        day: null,
        time: null,
        estimateMinutes: 60,
        difficulty: 'DIFICIL',
        priority: 'ALTA',
        notes: null,
      },
    ])
  })

  it('clicar de novo no botão escolhido limpa o campo', async () => {
    const wrapper = mount(TaskForm, { props: { task: { ...TASK, priority: 'ALTA' } } })
    expect(chip(wrapper, 'Alta').attributes('aria-pressed')).toBe('true')
    await chip(wrapper, 'Alta').trigger('click')
    expect(chip(wrapper, 'Alta').attributes('aria-pressed')).toBe('false')
  })

  it('exige o título', async () => {
    const wrapper = mount(TaskForm, { props: { task: { ...TASK, title: '' } } })
    await submit(wrapper)

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('Título é obrigatório')
  })

  it('emite cancelar', async () => {
    const wrapper = mount(TaskForm, { props: { task: TASK } })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Cancelar')!
      .trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
