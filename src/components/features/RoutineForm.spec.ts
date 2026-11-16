import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import RoutineForm from '@/components/features/RoutineForm.vue'
import type { RoutineItem } from '@/types/routine'

/** A validação do vee-validate é assíncrona: espera o `save` ou um erro em vez de um atraso fixo. */
async function submit(wrapper: VueWrapper) {
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => {
    if (!wrapper.emitted('save') && !wrapper.find('[role="alert"]').exists()) throw new Error('validação pendente')
  })
  await flushPromises()
}

const chip = (wrapper: VueWrapper, label: string) =>
  wrapper.findAll('button[aria-pressed]').find((b) => b.text() === label)!
const button = (wrapper: VueWrapper, text: string) => wrapper.findAll('button').find((b) => b.text() === text)!

async function fillName(wrapper: VueWrapper, value = 'Tomar remédio') {
  await wrapper.get('input[type="text"]').setValue(value)
}

describe('RoutineForm', () => {
  it('avisa que as alterações valem a partir do próximo sprint', () => {
    const wrapper = mount(RoutineForm)
    expect(wrapper.get('[data-testid="next-sprint-notice"]').text()).toContain('próximo sprint')
  })

  it('emite o item de dias da semana', async () => {
    const wrapper = mount(RoutineForm)
    await fillName(wrapper)
    await chip(wrapper, 'Qua').trigger('click')
    await chip(wrapper, 'Seg').trigger('click')
    await submit(wrapper)

    expect(wrapper.emitted('save')?.[0]).toEqual([
      {
        name: 'Tomar remédio',
        repeat: { mode: 'DIAS_DA_SEMANA', days: [1, 3] },
        times: [{ time: null }],
      },
    ])
  })

  it('exige ao menos um dia da semana', async () => {
    const wrapper = mount(RoutineForm)
    await fillName(wrapper)
    await submit(wrapper)

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('Marque ao menos um dia da semana')
  })

  it('exige o nome', async () => {
    const wrapper = mount(RoutineForm)
    await chip(wrapper, 'Seg').trigger('click')
    await submit(wrapper)

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('Nome é obrigatório')
  })

  it('no modo "a cada N dias" avisa sobre o fim de semana e emite intervalo e data', async () => {
    const wrapper = mount(RoutineForm)
    await fillName(wrapper, 'Regar plantas')
    await chip(wrapper, 'A cada N dias').trigger('click')

    expect(wrapper.find('[data-testid="weekend-warning"]').text()).toContain('lembretes, sem pontos')
    await wrapper.get('input[type="number"]').setValue('3')
    await submit(wrapper)

    const payload = wrapper.emitted('save')?.[0]?.[0] as { repeat: { mode: string; interval: number; startDate: string } }
    expect(payload.repeat.mode).toBe('A_CADA_N_DIAS')
    expect(payload.repeat.interval).toBe(3)
    expect(payload.repeat.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('recusa intervalo fora de 1 a 365', async () => {
    const wrapper = mount(RoutineForm)
    await fillName(wrapper)
    await chip(wrapper, 'A cada N dias').trigger('click')
    await wrapper.get('input[type="number"]').setValue('400')
    await submit(wrapper)

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('Intervalo')
  })

  it('permite várias vezes ao dia, com hora opcional', async () => {
    const wrapper = mount(RoutineForm)
    await fillName(wrapper)
    await chip(wrapper, 'Ter').trigger('click')
    await button(wrapper, 'Adicionar vez').trigger('click')
    const inputs = wrapper.findAll('input[type="time"]')
    expect(inputs).toHaveLength(2)
    await inputs[1]!.setValue('08:30')
    await submit(wrapper)

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      times: [{ time: null }, { time: '08:30' }],
    })
  })

  it('barra vezes repetidas no mesmo dia', async () => {
    const wrapper = mount(RoutineForm)
    await fillName(wrapper)
    await chip(wrapper, 'Ter').trigger('click')
    await button(wrapper, 'Adicionar vez').trigger('click')
    await submit(wrapper)

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('repetidas')
  })

  it('remove uma vez, mas mantém ao menos uma', async () => {
    const wrapper = mount(RoutineForm)
    await button(wrapper, 'Adicionar vez').trigger('click')
    await wrapper.get('button[aria-label="Remover vez 2"]').trigger('click')
    expect(wrapper.findAll('input[type="time"]')).toHaveLength(1)
    expect(wrapper.get('button[aria-label="Remover vez 1"]').attributes('disabled')).toBeDefined()
  })

  it('mostra a prévia das próximas ocorrências quando a regra é válida', async () => {
    const wrapper = mount(RoutineForm)
    expect(wrapper.find('[data-testid="routine-preview"]').exists()).toBe(false)
    await chip(wrapper, 'Seg').trigger('click')
    expect(wrapper.find('[data-testid="routine-preview"]').exists()).toBe(true)
  })

  it('preenche o formulário ao editar', async () => {
    const item: RoutineItem = {
      id: '1',
      areaId: 'a',
      name: 'Treinar',
      repeat: { mode: 'DIAS_DA_SEMANA', days: [2, 4] },
      times: [{ time: '18:00' }],
      createdAt: '',
    }
    const wrapper = mount(RoutineForm, { props: { item } })

    expect(chip(wrapper, 'Ter').attributes('aria-pressed')).toBe('true')
    expect(chip(wrapper, 'Seg').attributes('aria-pressed')).toBe('false')
    await submit(wrapper)
    expect(wrapper.emitted('save')?.[0]).toEqual([
      { name: 'Treinar', repeat: { mode: 'DIAS_DA_SEMANA', days: [2, 4] }, times: [{ time: '18:00' }] },
    ])
  })

  it('emite cancelar', async () => {
    const wrapper = mount(RoutineForm)
    await button(wrapper, 'Cancelar').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
