import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CompleteConfirmDialog from '@/components/features/CompleteConfirmDialog.vue'

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(CompleteConfirmDialog, {
    props: { open: true, name: 'Pintar a casa', kind: 'task', ...props },
    attachTo: document.body,
    global: { stubs: { teleport: true } },
  })
}

describe('CompleteConfirmDialog', () => {
  it('avisa que a ação não pode ser desfeita', () => {
    const wrapper = mountDialog()

    expect(wrapper.text()).toContain('Pintar a casa')
    expect(wrapper.text()).toContain('não pode ser desfeita')
    wrapper.unmount()
  })

  it('emite confirm ao clicar em Concluir', async () => {
    const wrapper = mountDialog()

    await wrapper.findAll('button').find((button) => button.text() === 'Concluir')!.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    wrapper.unmount()
  })

  it('tarefa atrasada mostra o aviso dos 20% com os pontos', () => {
    const wrapper = mountDialog({ overdue: true, points: 15, reducedPoints: 3 })

    expect(wrapper.get('[data-testid="late-warning"]').text()).toContain('20%')
    expect(wrapper.get('[data-testid="late-warning"]').text()).toContain('3 de 15 pts')
    wrapper.unmount()
  })

  it('rotina nunca mostra aviso de atraso', () => {
    const wrapper = mountDialog({ kind: 'routine', name: 'Treinar', overdue: true })

    expect(wrapper.find('[data-testid="late-warning"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('o item da rotina')
    wrapper.unmount()
  })
})
