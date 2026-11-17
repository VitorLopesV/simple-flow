import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SprintScoreboard from '@/components/features/SprintScoreboard.vue'
import type { Scoreboard } from '@/types/sprint'

const BOARD: Scoreboard = {
  total: 5000,
  done: 4498,
  // Arredonda para 90, mas a API diz que NÃO deu bônus: o selo segue `bonus`.
  percentage: 90,
  bonus: false,
  routine: { daysWithRoutine: 5, daysCompleted: 5, pointsPerDay: 40, total: 200, done: 200 },
  tasks: { count: 10, completed: 9, total: 4800, done: 4298 },
}

describe('SprintScoreboard', () => {
  it('mostra a recompensa em jogo o tempo todo', () => {
    const wrapper = mount(SprintScoreboard, { props: { scoreboard: BOARD, reward: 'Pedir pizza' } })
    expect(wrapper.find('[data-testid="scoreboard-reward"]').text()).toContain('Pedir pizza')
  })

  it('avisa quando não há recompensa definida', () => {
    const wrapper = mount(SprintScoreboard, { props: { scoreboard: BOARD, reward: null } })
    expect(wrapper.find('[data-testid="scoreboard-reward"]').text()).toContain('nenhuma definida')
  })

  it('o selo de bônus usa o campo bonus, nunca o percentual arredondado', () => {
    const without = mount(SprintScoreboard, { props: { scoreboard: BOARD } })
    expect(without.find('[data-testid="bonus-badge"]').exists()).toBe(false)
    const earned = mount(SprintScoreboard, { props: { scoreboard: { ...BOARD, bonus: true } } })
    expect(earned.find('[data-testid="bonus-badge"]').exists()).toBe(true)
  })

  it('sprint fechado mostra o resultado final', () => {
    const wrapper = mount(SprintScoreboard, { props: { scoreboard: BOARD, closed: true } })
    expect(wrapper.find('[data-testid="closed-badge"]').exists()).toBe(true)
  })
})
