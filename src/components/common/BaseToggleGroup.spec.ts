import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BaseToggleGroup from '@/components/common/BaseToggleGroup.vue'

const OPTIONS = [
  { value: 'a', label: 'Primeira', title: 'Dica da primeira' },
  { value: 'b', label: 'Segunda' },
]

function mountComponent(modelValue: string) {
  return mount(BaseToggleGroup, {
    props: { label: 'Dados do gráfico', options: OPTIONS, modelValue },
  })
}

describe('grupo de botões', () => {
  it('é um grupo com nome acessível e um botão por opção', () => {
    const screen = mountComponent('a')

    const group = screen.get('[role="group"]')
    expect(group.attributes('aria-label')).toBe('Dados do gráfico')
    expect(screen.findAll('button').map((button) => button.text())).toEqual(['Primeira', 'Segunda'])
    expect(screen.findAll('button')[0]?.attributes('title')).toBe('Dica da primeira')
  })

  it('marca só a opção selecionada como pressionada', () => {
    const screen = mountComponent('b')

    const [first, second] = screen.findAll('button')
    expect(first?.attributes('aria-pressed')).toBe('false')
    expect(second?.attributes('aria-pressed')).toBe('true')
    expect(second?.classes()).toContain('bg-success')
  })

  it('emite a opção clicada', async () => {
    const screen = mountComponent('a')

    await screen.findAll('button')[1]?.trigger('click')

    expect(screen.emitted('update:modelValue')).toEqual([['b']])
  })
})
