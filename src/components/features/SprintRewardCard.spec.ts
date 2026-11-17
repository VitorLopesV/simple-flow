import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import SprintRewardCard from '@/components/features/SprintRewardCard.vue'

function mountCard(props: Record<string, unknown> = {}) {
  return mount(SprintRewardCard, {
    props: { reward: null, defaultReward: 'Pizza', effectiveReward: 'Pizza', ...props },
    attachTo: document.body,
    global: { stubs: { teleport: true } },
  })
}

describe('SprintRewardCard', () => {
  it('mostra a recompensa efetiva e indica quando é a padrão', () => {
    const wrapper = mountCard()
    const text = wrapper.find('[data-testid="reward-current"]').text()
    expect(text).toContain('Pizza')
    expect(text).toContain('recompensa padrão')
    wrapper.unmount()
  })

  it('a própria do sprint não leva a marca de padrão', () => {
    const wrapper = mountCard({ reward: 'Cinema', effectiveReward: 'Cinema' })
    expect(wrapper.find('[data-testid="reward-current"]').text()).toBe('Cinema')
    wrapper.unmount()
  })

  it('emite saveReward ao salvar o campo', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="reward-form"] input').setValue('Cinema')
    await wrapper.find('[data-testid="reward-form"]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.emitted('saveReward')).toBeDefined())
    expect(wrapper.emitted('saveReward')).toEqual([['Cinema']])
    wrapper.unmount()
  })

  it('sprint fechado: sem campo de edição', () => {
    const wrapper = mountCard({ closed: true, reward: 'Cinema', effectiveReward: 'Cinema' })
    expect(wrapper.find('[data-testid="reward-form"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('não pode mais ser alterada')
    wrapper.unmount()
  })

  it('a recompensa padrão é configurada no modal e emite saveDefault', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="open-default-reward"]').trigger('click')
    await flushPromises()
    const forms = wrapper.findAll('[data-testid="reward-form"]')
    const modalForm = forms[forms.length - 1]!
    expect(modalForm.find('input').element.value).toBe('Pizza')
    await modalForm.find('input').setValue('Sorvete')
    await modalForm.trigger('submit')
    await vi.waitFor(() => expect(wrapper.emitted('saveDefault')).toBeDefined())
    expect(wrapper.emitted('saveDefault')).toEqual([['Sorvete']])
    wrapper.unmount()
  })
})
