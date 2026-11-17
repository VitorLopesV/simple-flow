import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PlanningReminder from '@/components/features/PlanningReminder.vue'

function mountAt(iso: string) {
  return mount(PlanningReminder, {
    props: { now: new Date(iso) },
    slots: { actions: '<button data-testid="act">Ir</button>' },
  })
}

const REMINDER = '[data-testid="planning-reminder"]'

describe('PlanningReminder', () => {
  it('aparece no domingo em São Paulo, com o slot de ações', () => {
    // 2026-11-22 é domingo; 15:00 UTC = 12:00 em São Paulo.
    const wrapper = mountAt('2026-11-22T15:00:00Z')
    expect(wrapper.find(REMINDER).exists()).toBe(true)
    expect(wrapper.text()).toContain('planejar a semana')
    expect(wrapper.find('[data-testid="act"]').exists()).toBe(true)
  })

  it.each([
    ['segunda', '2026-11-23T15:00:00Z'],
    ['sábado', '2026-11-21T15:00:00Z'],
  ])('não aparece na %s', (_label, iso) => {
    expect(mountAt(iso).find(REMINDER).exists()).toBe(false)
  })

  it('vale o fuso de São Paulo, não o do navegador ou o UTC', () => {
    // 01:00 UTC de segunda = 22:00 de domingo em SP (UTC-3): ainda é domingo.
    expect(mountAt('2026-11-23T01:00:00Z').find(REMINDER).exists()).toBe(true)
    // 02:00 UTC de domingo = 23:00 de sábado em SP: ainda não é domingo.
    expect(mountAt('2026-11-22T02:00:00Z').find(REMINDER).exists()).toBe(false)
  })
})
