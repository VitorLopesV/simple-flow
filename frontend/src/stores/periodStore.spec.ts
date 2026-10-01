import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { periodService } from '@/services/periodService'
import { usePeriodStore } from '@/stores/periodStore'

vi.mock('@/services/periodService', () => ({ periodService: { limits: vi.fn() } }))

const limits = vi.mocked(periodService.limits)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 15, 12))
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('estado inicial', () => {
  it('começa no mês atual', () => {
    const store = usePeriodStore()

    expect(store.period).toEqual({ month: 8, year: 2026 })
  })

  it('segue o relógio no momento da criação do store', () => {
    vi.setSystemTime(new Date(2027, 0, 31, 12))
    setActivePinia(createPinia())

    expect(usePeriodStore().period).toEqual({ month: 1, year: 2027 })
  })
})

describe('avancar / voltar', () => {
  it('avança 1 mês por padrão', () => {
    const store = usePeriodStore()

    store.next()

    expect(store.period).toEqual({ month: 9, year: 2026 })
  })

  it('volta 1 mês por padrão', () => {
    const store = usePeriodStore()

    store.previous()

    expect(store.period).toEqual({ month: 7, year: 2026 })
  })

  it('avança com virada de ano (dezembro → janeiro, que é o mês atual +1)', () => {
    vi.setSystemTime(new Date(2026, 11, 15, 12))
    setActivePinia(createPinia())
    const store = usePeriodStore()

    store.next()

    expect(store.period).toEqual({ month: 1, year: 2027 })
  })

  it('volta N meses com virada de ano', () => {
    const store = usePeriodStore()

    store.previous(8)

    expect(store.period).toEqual({ month: 12, year: 2025 })
  })

  it('avança de dezembro para janeiro e volta de janeiro para dezembro', () => {
    vi.setSystemTime(new Date(2026, 11, 15, 12))
    setActivePinia(createPinia())
    const store = usePeriodStore()

    store.next()
    expect(store.period).toEqual({ month: 1, year: 2027 })

    store.previous()
    expect(store.period).toEqual({ month: 12, year: 2026 })
  })

  it('avancar e voltar são inversos e 0 não altera', () => {
    const store = usePeriodStore()

    store.previous(14)
    store.next(14)
    expect(store.period).toEqual({ month: 8, year: 2026 })

    store.next(0)
    expect(store.period).toEqual({ month: 8, year: 2026 })
  })
})

describe('set', () => {
  it('atualiza o período', () => {
    const store = usePeriodStore()

    store.set({ month: 3, year: 2025 })

    expect(store.period).toEqual({ month: 3, year: 2025 })
  })

  it('copia o objeto: mutar o original não altera o store', () => {
    const store = usePeriodStore()
    const original = { month: 3, year: 2025 }

    store.set(original)
    original.month = 12
    original.year = 1999

    expect(store.period).toEqual({ month: 3, year: 2025 })
  })

  it('mutar o estado do store não altera o objeto informado', () => {
    const store = usePeriodStore()
    const original = { month: 3, year: 2025 }

    store.set(original)
    store.period.month = 11

    expect(original).toEqual({ month: 3, year: 2025 })
  })
})

describe('goToToday', () => {
  it('volta ao mês atual', () => {
    const store = usePeriodStore()
    store.previous(10)

    store.goToToday()

    expect(store.period).toEqual({ month: 8, year: 2026 })
  })

  it('usa o relógio no momento da chamada', () => {
    const store = usePeriodStore()
    vi.setSystemTime(new Date(2026, 8, 10, 12))

    store.goToToday()

    expect(store.period).toEqual({ month: 9, year: 2026 })
  })
})

describe('label', () => {
  it('formata o período atual e reage às mudanças', () => {
    const store = usePeriodStore()
    expect(store.label).toBe('Agosto de 2026')

    store.next()
    expect(store.label).toBe('Setembro de 2026')

    store.set({ month: 1, year: 2025 })
    expect(store.label).toBe('Janeiro de 2025')
  })
})

describe('isCurrentMonth', () => {
  it('é verdadeiro no mês atual e reage às mudanças', () => {
    const store = usePeriodStore()
    expect(store.isCurrentMonth).toBe(true)

    store.next()
    expect(store.isCurrentMonth).toBe(false)

    store.previous()
    expect(store.isCurrentMonth).toBe(true)
  })

  it('exige o mesmo ano, não só o mesmo mês', () => {
    const store = usePeriodStore()

    store.set({ month: 8, year: 2025 })

    expect(store.isCurrentMonth).toBe(false)
  })

  it('volta a ser verdadeiro após goToToday', () => {
    const store = usePeriodStore()
    store.previous(3)
    expect(store.isCurrentMonth).toBe(false)

    store.goToToday()

    expect(store.isCurrentMonth).toBe(true)
  })
})

describe('isolamento entre testes', () => {
  it('cada Pinia nova cria um store independente', () => {
    const first = usePeriodStore()
    first.next(3)

    setActivePinia(createPinia())
    const second = usePeriodStore()

    expect(second.period).toEqual({ month: 8, year: 2026 })
  })
})

describe('limites de navegação', () => {
  it('sem limites carregados, não passa do mês atual +1', () => {
    const store = usePeriodStore()

    store.next(5)

    expect(store.period).toEqual({ month: 9, year: 2026 })
    expect(store.canGoForward).toBe(false)
    expect(store.maxPeriod).toEqual({ month: 9, year: 2026 })
  })

  it('o teto é dinâmico: com o relógio em outubro, vai até novembro', () => {
    vi.setSystemTime(new Date(2026, 9, 10, 12))
    setActivePinia(createPinia())
    const store = usePeriodStore()

    store.next(3)

    expect(store.period).toEqual({ month: 11, year: 2026 })
  })

  it('set fora do intervalo é limitado ao mês válido mais próximo', () => {
    const store = usePeriodStore()

    store.set({ month: 5, year: 2030 })

    expect(store.period).toEqual({ month: 9, year: 2026 })
  })

  it('escrever direto em period (v-model) também respeita o limite', () => {
    const store = usePeriodStore()

    store.period = { month: 12, year: 2026 }

    expect(store.period).toEqual({ month: 9, year: 2026 })
  })

  it('loadLimits aplica o primeiro mês com dados como piso', async () => {
    limits.mockResolvedValue({
      firstMonth: { month: 1, year: 2026 },
      lastMonth: { month: 9, year: 2026 },
    })
    const store = usePeriodStore()

    await store.loadLimits()
    store.previous(20)

    expect(store.period).toEqual({ month: 1, year: 2026 })
    expect(store.canGoBack).toBe(false)
    expect(store.minPeriod).toEqual({ month: 1, year: 2026 })
  })

  it('mês sem dados dentro do intervalo continua acessível', async () => {
    limits.mockResolvedValue({
      firstMonth: { month: 1, year: 2026 },
      lastMonth: { month: 9, year: 2026 },
    })
    const store = usePeriodStore()
    await store.loadLimits()

    store.set({ month: 5, year: 2026 })

    expect(store.period).toEqual({ month: 5, year: 2026 })
    expect(store.canGoBack).toBe(true)
    expect(store.canGoForward).toBe(true)
  })

  it('loadLimits traz o período já selecionado para dentro do intervalo', async () => {
    limits.mockResolvedValue({
      firstMonth: { month: 3, year: 2026 },
      lastMonth: { month: 9, year: 2026 },
    })
    const store = usePeriodStore()
    store.set({ month: 1, year: 2025 })

    await store.loadLimits()

    expect(store.period).toEqual({ month: 3, year: 2026 })
  })

  it('usuário sem dados: só o mês atual e o seguinte', async () => {
    limits.mockResolvedValue({
      firstMonth: { month: 8, year: 2026 },
      lastMonth: { month: 9, year: 2026 },
    })
    const store = usePeriodStore()
    await store.loadLimits()

    store.previous()
    expect(store.period).toEqual({ month: 8, year: 2026 })
    expect(store.canGoBack).toBe(false)

    store.next(2)
    expect(store.period).toEqual({ month: 9, year: 2026 })
    expect(store.canGoForward).toBe(false)
  })

  it('falha ao buscar os limites mantém só o teto e não lança', async () => {
    limits.mockRejectedValue(new Error('offline'))
    const store = usePeriodStore()

    await expect(store.loadLimits()).resolves.toBeUndefined()
    store.previous(30)

    expect(store.limits).toBeNull()
    expect(store.period).toEqual({ month: 2, year: 2024 })
  })
})
