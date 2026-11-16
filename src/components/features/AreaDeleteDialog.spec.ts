import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AreaDeleteDialog from '@/components/features/AreaDeleteDialog.vue'
import type { Area } from '@/types/area'

function area(id: string, name: string, system = false): Area {
  return { id, name, color: '#3b82f6', system, createdAt: '' }
}

const AREAS = [area('r', 'Rotina', true), area('t', 'Trabalho'), area('f', 'Faculdade')]

const values = () =>
  Array.from(document.body.querySelectorAll('option')).map((option) => option.textContent?.trim())

async function mountDialog(areas = AREAS) {
  const wrapper = mount(AreaDeleteDialog, {
    props: { open: false, area: AREAS[1]!, areas },
    attachTo: document.body,
  })
  await wrapper.setProps({ open: true })
  return wrapper
}

const button = (label: string) =>
  Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!

describe('AreaDeleteDialog', () => {
  it('move as tarefas para a primeira área do usuário, nunca a Rotina', async () => {
    const wrapper = await mountDialog()
    button('Excluir área').click()
    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ action: 'move', targetAreaId: 'f' }])
    wrapper.unmount()
  })

  it('não lista a Rotina como destino', async () => {
    const wrapper = await mountDialog()
    expect(values()).toEqual(['Faculdade'])
    wrapper.unmount()
  })

  it('sem outra área, desabilita mover e deixa só excluir junto', async () => {
    const wrapper = await mountDialog([AREAS[0]!, AREAS[1]!])
    expect(document.body.querySelector<HTMLInputElement>('input[value="move"]')!.disabled).toBe(true)
    button('Excluir área').click()
    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ action: 'delete' }])
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
