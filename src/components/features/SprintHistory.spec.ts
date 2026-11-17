import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SprintHistory from '@/components/features/SprintHistory.vue'
import SprintHistoryItem from '@/components/features/SprintHistoryItem.vue'
import { sprintService } from '@/services/sprintService'
import type { SprintHistoryEntry, SprintHistoryTask } from '@/types/sprint'

vi.mock('@/services/sprintService', () => ({ sprintService: { listHistory: vi.fn() } }))
vi.mock('@/composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }))

const service = vi.mocked(sprintService)

function task(id: string, title: string, day: string, earnedPoints: number, outcome: SprintHistoryTask['outcome']) {
  return {
    id,
    title,
    day,
    time: null,
    estimateMinutes: 60,
    difficulty: 'MEDIA',
    priority: 'ALTA',
    points: 30,
    earnedPoints,
    outcome,
  }
}

const ENTRY: SprintHistoryEntry = {
  sprintId: 'spr_1',
  startDate: '2026-11-09',
  endDate: '2026-11-13',
  closedAt: '2026-11-14T03:00:00.000Z',
  total: 5000,
  done: 4498,
  // Arredonda para 90, mas a API diz que NÃO deu bônus.
  percentage: 90,
  bonus: false,
  reward: 'Pedir pizza',
  rewardEarned: false,
  routine: {
    daysWithRoutine: 2,
    daysCompleted: 1,
    pointsPerDay: 40,
    total: 80,
    done: 40,
    days: [
      { date: '2026-11-09', completed: true, items: [{ name: 'Treinar', time: '07:00', completed: true }] },
      { date: '2026-11-10', completed: false, items: [{ name: 'Treinar', time: '07:00', completed: false }] },
    ],
  },
  tasks: {
    count: 3,
    completed: 2,
    total: 90,
    done: 36,
    late: 1,
    notCompleted: 1,
    items: [
      task('t1', 'Relatório', '2026-11-09', 30, 'CONCLUIDA'),
      task('t2', 'Faxina', '2026-11-10', 6, 'ATRASADA'),
      task('t3', 'Estudar', '2026-11-11', 0, 'NAO_CONCLUIDA'),
    ],
  },
}

function mountHistory() {
  setActivePinia(createPinia())
  return mount(SprintHistory)
}

describe('SprintHistory', () => {
  beforeEach(() => vi.resetAllMocks())

  it('mostra o carregando antes da primeira resposta', () => {
    service.listHistory.mockReturnValue(new Promise(() => {}))
    const wrapper = mountHistory()
    expect(wrapper.find('[data-testid="history-loading"]').exists()).toBe(true)
  })

  it('mostra o estado vazio quando não há sprint fechado', async () => {
    service.listHistory.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 })
    const wrapper = mountHistory()
    await flushPromises()
    expect(wrapper.find('[data-testid="history-empty"]').text()).toContain('Nenhum sprint fechado ainda')
    expect(wrapper.find('nav[aria-label="Paginação"]').exists()).toBe(false)
  })

  it('mostra o erro com botão de tentar de novo', async () => {
    service.listHistory
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce({ items: [ENTRY], page: 1, pageSize: 10, total: 1, totalPages: 1 })
    const wrapper = mountHistory()
    await flushPromises()
    expect(wrapper.find('[data-testid="history-error"]').attributes('role')).toBe('alert')
    await wrapper.find('[data-testid="history-error"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="history-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="history-spr_1"]').exists()).toBe(true)
  })

  it('lista o período, pontos, percentual e recompensa de cada sprint', async () => {
    service.listHistory.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 10, total: 1, totalPages: 1 })
    const wrapper = mountHistory()
    await flushPromises()
    expect(wrapper.find('[data-testid="history-spr_1"]').text()).toContain('09/11/2026 a 13/11/2026')
    expect(wrapper.find('[data-testid="history-points"]').text()).toContain('4498')
    expect(wrapper.find('[data-testid="history-points"]').text()).toContain('90,0%')
    expect(wrapper.find('[data-testid="history-reward"]').text()).toContain('Pedir pizza')
  })

  it('pagina pelo servidor com botões acessíveis', async () => {
    service.listHistory.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 10, total: 25, totalPages: 3 })
    const wrapper = mountHistory()
    await flushPromises()
    service.listHistory.mockResolvedValue({ items: [ENTRY], page: 2, pageSize: 10, total: 25, totalPages: 3 })
    await wrapper.find('button[aria-label="Próxima página"]').trigger('click')
    await flushPromises()
    expect(service.listHistory).toHaveBeenLastCalledWith({ page: 2, pageSize: 10 })
    expect(wrapper.find('button[aria-current="page"]').text()).toBe('2')
  })
})

describe('SprintHistoryItem', () => {
  it('o selo de bônus usa o campo bonus, nunca o percentual arredondado', () => {
    const without = mount(SprintHistoryItem, { props: { entry: ENTRY } })
    expect(without.find('[data-testid="history-bonus"]').exists()).toBe(false)
    expect(without.find('[data-testid="history-no-bonus"]').text()).toBe('Sem bônus')
    const withBonus = mount(SprintHistoryItem, {
      props: { entry: { ...ENTRY, percentage: 89.9, bonus: true, rewardEarned: true } },
    })
    expect(withBonus.find('[data-testid="history-bonus"]').text()).toContain('Bônus liberado')
    expect(withBonus.find('[data-testid="history-reward-earned"]').exists()).toBe(true)
  })

  it('sem recompensa mostra "Sem recompensa"', () => {
    const wrapper = mount(SprintHistoryItem, { props: { entry: { ...ENTRY, reward: null } } })
    expect(wrapper.find('[data-testid="history-reward"]').text()).toBe('Sem recompensa')
  })

  it('o detalhe abre e fecha, com aria-expanded, e mostra tarefas e rotina por dia', async () => {
    const wrapper = mount(SprintHistoryItem, { props: { entry: ENTRY } })
    const toggle = wrapper.find('[data-testid="history-toggle-spr_1"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="history-detail-spr_1"]').exists()).toBe(false)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const detail = wrapper.find('[data-testid="history-detail-spr_1"]')
    expect(toggle.attributes('aria-controls')).toBe(detail.attributes('id'))
    expect(wrapper.find('[data-testid="history-task-summary"]').text()).toBe(
      '1 concluídas · 1 atrasadas · 1 não concluídas',
    )
    const tasks = wrapper.findAll('[data-testid="history-task"]')
    expect(tasks[0].text()).toContain('Concluída')
    expect(tasks[1].text()).toContain('Concluída com atraso')
    expect(tasks[2].text()).toContain('Não concluída')
    const days = wrapper.findAll('[data-testid="history-routine-day"]')
    expect(days[0].text()).toContain('Cumprida')
    expect(days[1].text()).toContain('Não cumprida')

    await toggle.trigger('click')
    expect(wrapper.find('[data-testid="history-detail-spr_1"]').exists()).toBe(false)
  })
})
