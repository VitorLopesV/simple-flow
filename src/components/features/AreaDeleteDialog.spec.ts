import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AreaDeleteDialog from '@/components/features/AreaDeleteDialog.vue'
import type { Area } from '@/types/area'

function area(id: string, name: string, system = false): Area {
  return { id, name, color: '#3b82f6', system, createdAt: '' }
}

const AREAS = [area('r', 'Rotina', true), area('t', 'Trabalho'), area('f', 'Faculdade')]

async function mountDialog() {
  const wrapper = mount(AreaDeleteDialog, {
    props: { open: false, area: AREAS[1]!, areas: AREAS },
    attachTo: document.body,
  })
  await wrapper.setProps({ open: true })
  return wrapper
}

const button = (label: string) =>
  Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!

describe('AreaDeleteDialog', () => {
  it('move as tarefas para a primeira outra área por padrão', async () => {
    const wrapper = await mountDialog()
    button('Excluir área').click()
    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ action: 'move', targetAreaId: 'r' }])
    wrapper.unmount()
  })

  it('exclui as tarefas junto quando escolhido', async () => {
    const wrapper = await mountDialog()
    document.body.querySelector<HTMLInputElement>('input[value="delete"]')!.click()
    await wrapper.vm.$nextTick()
    button('Excluir área').click()
    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ action: 'delete' }])
    wrapper.unmount()
  })
})
