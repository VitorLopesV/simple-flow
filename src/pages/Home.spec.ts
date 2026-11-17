import { flushPromises, mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Home from '@/pages/Home.vue'
import { homeService } from '@/services/homeService'
import { notificationService } from '@/services/notificationService'
import { sprintService } from '@/services/sprintService'
import { taskService } from '@/services/taskService'
import type { HomeOccurrence, HomeSummary, HomeTask } from '@/types/home'

vi.mock('@/services/homeService', () => ({ homeService: { summary: vi.fn() } }))
vi.mock('@/services/notificationService', () => ({ notificationService: { list: vi.fn() } }))
vi.mock('@/services/sprintService', () => ({ sprintService: { completeOccurrence: vi.fn() } }))
vi.mock('@/services/taskService', () => ({ taskService: { complete: vi.fn() } }))

const summaryMock = vi.mocked(homeService.summary)
const completeOccurrenceMock = vi.mocked(sprintService.completeOccurrence)
const completeTaskMock = vi.mocked(taskService.complete)
const alertsMock = vi.mocked(notificationService.list)

function occurrence(id: string, name: string, overrides: Partial<HomeOccurrence> = {}): HomeOccurrence {
  return { id, name, date: '2026-11-18', time: null, done: false, completedAt: null, ...overrides }
}

function homeTask(id: string, overrides: Partial<HomeTask> = {}): HomeTask {
  return {
    id,
    title: `Tarefa ${id}`,
    areaId: 'a1',
    day: '2026-11-18',
    time: null,
    estimateMinutes: 60,
    difficulty: 'MEDIA',
    priority: 'ALTA',
    inSprint: true,
    done: false,
    completedAt: null,
    overdue: false,
    ...overrides,
  }
}

function summary(overrides: Partial<HomeSummary> = {}): HomeSummary {
  return {
    today: '2026-11-18',
    weekend: false,
    week: { start: '2026-11-16', end: '2026-11-22' },
    mission: {
      total: 2,
      completed: 1,
      occurrences: [occurrence('o1', 'Treinar', { done: true, time: '07:00' }), occurrence('o2', 'Ler 20 páginas')],
    },
    todayTasks: [homeTask('t1', { time: '09:00' }), homeTask('t2', { overdue: true, time: '08:00' })],
    scoreboard: {
      sprintId: 'spr_1',
      startDate: '2026-11-16',
      endDate: '2026-11-20',
      closed: false,
      closedAt: null,
      total: 100,
      done: 45,
      percentage: 45,
      bonus: false,
      reward: 'Jantar fora',
    },
    weekBills: {
      total: 350.5,
      count: 2,
      bills: [
        { id: 'sai_1', description: 'Luz', amount: 150.5, dueDate: '2026-11-17', overdue: true, automatic: false, categoryId: 'c', paymentMethod: 'BOLETO' },
        { id: 'sai_fat_1', description: 'Fatura – Itaú', amount: 200, dueDate: '2026-11-20', overdue: false, automatic: true, categoryId: 'c', paymentMethod: 'CARTAO_CREDITO' },
      ],
    },
    finances: {
      referenceMonth: '2026-11',
      totalIncome: 5000,
      totalExpenses: 3200,
      balance: 1800,
      totalInvoices: 800,
      incomeChange: 0.1,
      expenseChange: -0.05,
      incomeSeries: [],
      expenseSeries: [],
    },
    reminders: [],
    ...overrides,
  }
}

let wrapper: VueWrapper | undefined

async function mountHome(data: HomeSummary = summary()) {
  summaryMock.mockResolvedValue(data)
  wrapper = mount(Home, {
    attachTo: document.body,
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
  await flushPromises()
  return wrapper
}

const byTestId = (screen: VueWrapper, id: string) => screen.find(`[data-testid="${id}"]`)

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  alertsMock.mockResolvedValue([])
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('Home', () => {
  it('mostra o esqueleto enquanto carrega', async () => {
    summaryMock.mockReturnValue(new Promise(() => {}))
    wrapper = mount(Home, { global: { stubs: { RouterLink: RouterLinkStub } } })

    await wrapper.vm.$nextTick()

    expect(byTestId(wrapper, 'home-loading').exists()).toBe(true)
  })

  it('erro ao carregar: mostra a mensagem e tenta de novo', async () => {
    summaryMock.mockRejectedValueOnce(new Error('x'))
    wrapper = mount(Home, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()

    expect(byTestId(wrapper, 'home-error').find('[role="alert"]').exists()).toBe(true)

    summaryMock.mockResolvedValueOnce(summary())
    await byTestId(wrapper, 'home-error').find('button').trigger('click')
    await flushPromises()

    expect(byTestId(wrapper, 'home-mission').exists()).toBe(true)
  })

  it('mostra os blocos: missão, tarefas, placar com recompensa, contas e finanças', async () => {
    const screen = await mountHome()

    expect(byTestId(screen, 'home-mission').exists()).toBe(true)
    expect(byTestId(screen, 'home-tasks').exists()).toBe(true)
    expect(byTestId(screen, 'home-bills').exists()).toBe(true)
    expect(byTestId(screen, 'home-finances').exists()).toBe(true)
    expect(byTestId(screen, 'scoreboard-points').text()).toContain('45')
    expect(byTestId(screen, 'scoreboard-reward').text()).toContain('Jantar fora')
  })

  it('o placar da Home não mostra o detalhe de rotina e tarefas', async () => {
    const screen = await mountHome()

    expect(byTestId(screen, 'scoreboard-routine').exists()).toBe(false)
  })

  it('selo de bônus vem do campo bonus, não do percentual', async () => {
    const screen = await mountHome(summary({ scoreboard: { ...summary().scoreboard, percentage: 90, bonus: false } }))
    expect(byTestId(screen, 'bonus-badge').exists()).toBe(false)

    wrapper!.unmount()
    const withBonus = await mountHome(summary({ scoreboard: { ...summary().scoreboard, percentage: 89.96, bonus: true } }))
    expect(byTestId(withBonus, 'bonus-badge').exists()).toBe(true)
  })

  it('missão: mostra o progresso e marca os itens concluídos', async () => {
    const screen = await mountHome()

    expect(byTestId(screen, 'mission-progress-text').text()).toBe('1 de 2 itens')
    const items = screen.findAll('[data-testid="mission-item"] button')
    expect(items[0]!.attributes('disabled')).toBeDefined()
    expect(items[0]!.attributes('aria-label')).toBe('Treinar: concluído')
    expect(items[1]!.attributes('aria-label')).toBe('Concluir Ler 20 páginas')
  })

  it('tarefas de hoje na ordem recebida, com selo de atraso', async () => {
    const screen = await mountHome()

    const items = screen.findAll('[data-testid="task-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('09:00')
    expect(items[1]!.find('[data-testid="task-overdue"]').exists()).toBe(true)
  })

  it('tarefa só planejada (fora do sprint) avisa que não pontua', async () => {
    const screen = await mountHome(summary({ todayTasks: [homeTask('t3', { inSprint: false })] }))

    expect(byTestId(screen, 'task-not-in-sprint').exists()).toBe(true)
  })

  it('contas da semana: total, vencida marcada e link para a saída (fatura vai para Cartões)', async () => {
    const screen = await mountHome()

    expect(byTestId(screen, 'bills-total').text()).toContain('350,50')
    expect(byTestId(screen, 'bill-overdue').exists()).toBe(true)
    const links = screen.findAllComponents(RouterLinkStub).filter((link) => link.attributes('aria-label')?.includes('vence em'))
    expect(links.map((link) => link.props('to'))).toEqual([{ name: 'expenses' }, { name: 'cards' }])
  })

  it('sem contas na semana mostra o estado vazio', async () => {
    const screen = await mountHome(summary({ weekBills: { total: 0, count: 0, bills: [] } }))

    expect(byTestId(screen, 'bills-empty').exists()).toBe(true)
  })

  it('finanças: saldo e link para o Dashboard', async () => {
    const screen = await mountHome()

    expect(byTestId(screen, 'finances-balance').text()).toContain('1.800,00')
    const link = screen.findAllComponents(RouterLinkStub).find((item) => item.props('to') && (item.props('to') as { name: string }).name === 'dashboard')
    expect(link).toBeTruthy()
  })

  it('sem tarefas nem missão, mostra os estados vazios', async () => {
    const screen = await mountHome(summary({ mission: { total: 0, completed: 0, occurrences: [] }, todayTasks: [] }))

    expect(byTestId(screen, 'mission-empty').exists()).toBe(true)
    expect(byTestId(screen, 'tasks-empty').exists()).toBe(true)
  })
})

describe('Home: concluir com confirmação', () => {
  it('concluir uma tarefa abre a confirmação e só conclui ao confirmar', async () => {
    completeTaskMock.mockResolvedValue({} as never)
    const screen = await mountHome()

    await screen.get('[aria-label="Concluir Tarefa t1"]').trigger('click')
    await flushPromises()
    expect(completeTaskMock).not.toHaveBeenCalled()
    const dialog = document.body.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Essa ação não pode ser desfeita')

    const confirm = [...dialog.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Concluir')!
    confirm.click()
    await flushPromises()

    expect(completeTaskMock).toHaveBeenCalledWith('t1')
    expect(summaryMock).toHaveBeenCalledTimes(2)
    // Concluir pode apagar um alerta: o sino é recarregado.
    expect(alertsMock).toHaveBeenCalled()
  })

  it('tarefa atrasada avisa que concluir agora vale 20% dos pontos', async () => {
    const screen = await mountHome()

    await screen.get('[aria-label="Concluir Tarefa t2"]').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('[data-testid="late-warning"]')?.textContent).toContain('20%')
  })

  it('cancelar não conclui nada', async () => {
    const screen = await mountHome()

    await screen.get('[aria-label="Concluir Tarefa t1"]').trigger('click')
    await flushPromises()
    const cancel = [...document.body.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent?.trim() === 'Cancelar')!
    ;(cancel as HTMLElement).click()
    await flushPromises()

    expect(completeTaskMock).not.toHaveBeenCalled()
  })

  it('concluir um item da rotina pede a mesma confirmação e usa a rota de ocorrências', async () => {
    completeOccurrenceMock.mockResolvedValue({} as never)
    const screen = await mountHome()

    await screen.get('[aria-label="Concluir Ler 20 páginas"]').trigger('click')
    await flushPromises()
    expect(completeOccurrenceMock).not.toHaveBeenCalled()

    const confirm = [...document.body.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent?.trim() === 'Concluir')!
    ;(confirm as HTMLElement).click()
    await flushPromises()

    expect(completeOccurrenceMock).toHaveBeenCalledWith('o2')
  })

  it('falha ao concluir mantém a tela e não fecha a confirmação em silêncio', async () => {
    completeTaskMock.mockRejectedValue(new Error('x'))
    const screen = await mountHome()

    await screen.get('[aria-label="Concluir Tarefa t1"]').trigger('click')
    await flushPromises()
    const confirm = [...document.body.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent?.trim() === 'Concluir')!
    ;(confirm as HTMLElement).click()
    await flushPromises()

    expect(completeTaskMock).toHaveBeenCalled()
    expect(byTestId(screen, 'home-tasks').exists()).toBe(true)
    expect(summaryMock).toHaveBeenCalledTimes(1)
  })
})

describe('Home: fim de semana', () => {
  const weekendSummary = () =>
    summary({
      today: '2026-11-21',
      weekend: true,
      mission: { total: 0, completed: 0, occurrences: [] },
      scoreboard: { ...summary().scoreboard, closed: true, closedAt: '2026-11-20T23:59:00.000Z', bonus: true, percentage: 92 },
      reminders: [
        occurrence('l1', 'Ligar para a família', { date: '2026-11-21', time: '10:00' }),
        occurrence('l2', 'Regar as plantas', { date: '2026-11-22' }),
      ],
    })

  it('missão vazia com aviso, placar como resultado final e lembretes sem pontos', async () => {
    const screen = await mountHome(weekendSummary())

    expect(byTestId(screen, 'mission-empty').text()).toContain('Fim de semana')
    expect(byTestId(screen, 'closed-badge').exists()).toBe(true)
    expect(byTestId(screen, 'bonus-badge').exists()).toBe(true)
    const reminders = byTestId(screen, 'home-reminders')
    expect(reminders.text()).toContain('Sem pontos')
    expect(reminders.findAll('[data-testid="reminder-item"]')).toHaveLength(2)
  })

  it('lembrete de hoje pode ser concluído; o de outro dia fica só para consulta', async () => {
    const screen = await mountHome(weekendSummary())

    const [today, other] = screen.findAll('[data-testid="reminder-item"] button')
    expect(today!.attributes('disabled')).toBeUndefined()
    expect(other!.attributes('disabled')).toBeDefined()
  })

  it('concluir lembrete usa a mesma confirmação', async () => {
    completeOccurrenceMock.mockResolvedValue({} as never)
    const screen = await mountHome(weekendSummary())

    await screen.get('[aria-label="Concluir lembrete Ligar para a família"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    const confirm = [...document.body.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent?.trim() === 'Concluir')!
    ;(confirm as HTMLElement).click()
    await flushPromises()

    expect(completeOccurrenceMock).toHaveBeenCalledWith('l1')
  })
})

describe('Home: aviso de domingo', () => {
  it('no domingo (America/Sao_Paulo) mostra o aviso de planejamento com o link para o Sprint', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-22T15:00:00Z'))

    const screen = await mountHome()

    expect(byTestId(screen, 'planning-reminder').exists()).toBe(true)
    expect(byTestId(screen, 'planning-link').exists()).toBe(true)
  })

  it('fora do domingo o aviso não aparece', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T15:00:00Z'))

    const screen = await mountHome()

    expect(byTestId(screen, 'planning-reminder').exists()).toBe(false)
  })
})
