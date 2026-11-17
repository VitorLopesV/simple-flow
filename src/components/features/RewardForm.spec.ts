import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import RewardForm from '@/components/features/RewardForm.vue'

function mountForm(modelValue: string | null = null) {
  return mount(RewardForm, { props: { modelValue, label: 'Recompensa deste sprint' } })
}

async function submit(wrapper: ReturnType<typeof mountForm>, text: string) {
  await wrapper.find('input').setValue(text)
  await wrapper.find('form').trigger('submit')
  // A validação do vee-validate é assíncrona: espera o `save` ou o erro.
  await vi.waitFor(() => {
    if (!wrapper.emitted('save') && !wrapper.find('[role="alert"]').exists()) throw new Error('validação pendente')
  })
  await flushPromises()
}

describe('RewardForm', () => {
  it('emite o texto aparado', async () => {
    const wrapper = mountForm()
    await submit(wrapper, '  Pedir pizza  ')
    expect(wrapper.emitted('save')).toEqual([['Pedir pizza']])
  })

  it('vazio é válido e emite null (volta a usar a padrão)', async () => {
    const wrapper = mountForm('Cinema')
    expect(wrapper.find('input').element.value).toBe('Cinema')
    await submit(wrapper, '   ')
    expect(wrapper.emitted('save')).toEqual([[null]])
  })

  it('recusa mais de 120 caracteres, mostrando o erro e sem emitir', async () => {
    const wrapper = mountForm()
    await submit(wrapper, 'a'.repeat(121))
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('no máximo 120')
  })

  it('aceita exatamente 120 caracteres', async () => {
    const wrapper = mountForm()
    await submit(wrapper, 'a'.repeat(120))
    expect(wrapper.emitted('save')).toHaveLength(1)
  })
})
