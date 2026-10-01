import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import EditedMonthsDialog from '@/components/features/EditedMonthsDialog.vue'

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(EditedMonthsDialog, {
    props: { open: true, action: 'remove', months: ['2026-10'], description: 'Aluguel', ...props },
    global: { stubs: { teleport: true } },
  })
}

const button = (wrapper: ReturnType<typeof mountDialog>, text: string) =>
  wrapper.findAll('button').find((item) => item.text() === text)

describe('EditedMonthsDialog', () => {
  it('lista os meses alterados por extenso', () => {
    const wrapper = mountDialog({ months: ['2026-10', '2026-11'] })

    expect(wrapper.findAll('li').map((item) => item.text())).toEqual([
      'Outubro de 2026',
      'Novembro de 2026',
    ])
    expect(wrapper.text()).toContain('“Aluguel” tem meses seguintes alterados na série:')
  })

  it('no singular quando só um mês foi alterado', () => {
    expect(mountDialog().text()).toContain('“Aluguel” tem um mês seguinte alterado na série:')
  })

  it('deixa claro que os meses anteriores não são afetados', () => {
    expect(mountDialog().text()).toContain('Os meses anteriores não são afetados.')
  })

  it('explica a consequência de excluir e de desligar a recorrência', () => {
    expect(mountDialog({ action: 'remove' }).text()).toContain(
      'Excluir remove este mês e todos os seguintes da série',
    )
    expect(mountDialog({ action: 'deactivate' }).text()).toContain(
      'Desligar a recorrência mantém este mês e remove todos os seguintes',
    )
  })

  it('tem os botões Cancelar e Remover mesmo assim', async () => {
    const wrapper = mountDialog()

    await button(wrapper, 'Remover mesmo assim')!.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)

    await button(wrapper, 'Cancelar')!.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
