import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MonthPicker from '@/components/features/MonthPicker.vue'
import type { Period } from '@/types/common'

type Props = InstanceType<typeof MonthPicker>['$props']

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/** Monta ligado como `v-model` (o período emitido volta como prop), com "hoje" em agosto de 2026. */
function mountComponent(modelValue: Period, props: Partial<Props> = {}) {
  const wrapper: VueWrapper = mount(MonthPicker, {
    props: {
      modelValue,
      'onUpdate:modelValue': (period: Period) => wrapper.setProps({ modelValue: period }),
      ...props,
    } as Props,
  })
  return wrapper
}

const previous = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Mês anterior"]')
const next = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Próximo mês"]')
const monthSelect = (wrapper: VueWrapper) => wrapper.get('select#month-select')
const yearSelect = (wrapper: VueWrapper) => wrapper.get('select#year-select')
const todayButton = (wrapper: VueWrapper) => wrapper.find('button[title="Voltar para o mês atual"]')

const emittedPeriods = (wrapper: VueWrapper) =>
  (wrapper.emitted('update:modelValue') ?? []).map(([period]) => period as Period)
const lastPeriod = (wrapper: VueWrapper) => emittedPeriods(wrapper).at(-1)

const listedYears = (wrapper: VueWrapper) =>
  yearSelect(wrapper)
    .findAll('option')
    .map((option) => Number(option.attributes('value')))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 7, 15, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('botões anterior e próximo', () => {
  it('próximo avança um mês', async () => {
    const wrapper = mountComponent({ month: 8, year: 2026 })

    await next(wrapper).trigger('click')

    expect(lastPeriod(wrapper)).toEqual({ month: 9, year: 2026 })
  })

  it('anterior volta um mês', async () => {
    const wrapper = mountComponent({ month: 8, year: 2026 })

    await previous(wrapper).trigger('click')

    expect(lastPeriod(wrapper)).toEqual({ month: 7, year: 2026 })
  })

  it('de dezembro, próximo vai para janeiro do ano seguinte', async () => {
    const wrapper = mountComponent({ month: 12, year: 2026 })

    await next(wrapper).trigger('click')

    expect(lastPeriod(wrapper)).toEqual({ month: 1, year: 2027 })
  })

  it('de janeiro, anterior vai para dezembro do ano anterior', async () => {
    const wrapper = mountComponent({ month: 1, year: 2026 })

    await previous(wrapper).trigger('click')

    expect(lastPeriod(wrapper)).toEqual({ month: 12, year: 2025 })
  })

  it('cliques em sequência acumulam a navegação', async () => {
    const wrapper = mountComponent({ month: 11, year: 2026 })

    await next(wrapper).trigger('click')
    await next(wrapper).trigger('click')
    await next(wrapper).trigger('click')

    expect(emittedPeriods(wrapper)).toEqual([
      { month: 12, year: 2026 },
      { month: 1, year: 2027 },
      { month: 2, year: 2027 },
    ])
  })

  it('não altera o objeto de período recebido', async () => {
    const original = { month: 12, year: 2026 }
    const wrapper = mountComponent(original)

    await next(wrapper).trigger('click')

    expect(original).toEqual({ month: 12, year: 2026 })
  })
})

describe('selects de mês e ano', () => {
  it('trocar o mês emite o novo período mantendo o ano', async () => {
    const wrapper = mountComponent({ month: 8, year: 2026 })

    await monthSelect(wrapper).setValue('3')

    expect(lastPeriod(wrapper)).toEqual({ month: 3, year: 2026 })
  })

  it('trocar o ano emite o novo período mantendo o mês', async () => {
    const wrapper = mountComponent({ month: 8, year: 2026 })

    await yearSelect(wrapper).setValue('2024')

    expect(lastPeriod(wrapper)).toEqual({ month: 8, year: 2024 })
  })

  it('o valor emitido é numérico, nunca texto', async () => {
    const wrapper = mountComponent({ month: 8, year: 2026 })

    await monthSelect(wrapper).setValue('5')
    await yearSelect(wrapper).setValue('2025')

    for (const period of emittedPeriods(wrapper)) {
      expect(typeof period.month).toBe('number')
      expect(typeof period.year).toBe('number')
    }
    expect(lastPeriod(wrapper)).toEqual({ month: 5, year: 2025 })
  })

  it('mostra o período atual selecionado nos dois selects', () => {
    const wrapper = mountComponent({ month: 3, year: 2025 })

    expect((monthSelect(wrapper).element as HTMLSelectElement).value).toBe('3')
    expect((yearSelect(wrapper).element as HTMLSelectElement).value).toBe('2025')
  })

  it('acompanha o período quando ele muda por fora', async () => {
    const wrapper = mountComponent({ month: 8, year: 2026 })

    await wrapper.setProps({ modelValue: { month: 1, year: 2024 } })

    expect((monthSelect(wrapper).element as HTMLSelectElement).value).toBe('1')
    expect((yearSelect(wrapper).element as HTMLSelectElement).value).toBe('2024')
  })

  it('a lista de meses tem os 12 meses, de Janeiro a Dezembro, com valores 1 a 12', () => {
    const options = monthSelect(mountComponent({ month: 8, year: 2026 })).findAll('option')

    expect(options.map((option) => option.text())).toEqual(MONTHS)
    expect(options.map((option) => Number(option.attributes('value')))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('os selects têm rótulos acessíveis', () => {
    const wrapper = mountComponent({ month: 8, year: 2026 })

    expect(wrapper.get('label[for="month-select"]').text()).toBe('Mês')
    expect(wrapper.get('label[for="year-select"]').text()).toBe('Ano')
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Selecionar período')
  })
})

describe('lista de anos', () => {
  it('padrão: 4 anos anteriores, o ano atual e o próximo (relógio em 2026)', () => {
    expect(listedYears(mountComponent({ month: 8, year: 2026 }))).toEqual([2022, 2023, 2024, 2025, 2026, 2027])
  })

  it('availableYears customizado altera o tamanho da janela', () => {
    expect(listedYears(mountComponent({ month: 8, year: 2026 }, { availableYears: 3 }))).toEqual([2024, 2025, 2026, 2027])
    expect(listedYears(mountComponent({ month: 8, year: 2026 }, { availableYears: 1 }))).toEqual([2026, 2027])
  })

  it('a janela é ancorada no ano de hoje, não no período selecionado', () => {
    expect(listedYears(mountComponent({ month: 1, year: 2024 }))).toEqual([2022, 2023, 2024, 2025, 2026, 2027])
  })

  it('acompanha o relógio no momento da montagem', () => {
    vi.setSystemTime(new Date(2030, 0, 10, 12))

    expect(listedYears(mountComponent({ month: 1, year: 2030 }))).toEqual([2026, 2027, 2028, 2029, 2030, 2031])
  })

  it('a lista está em ordem crescente e sem repetições', () => {
    const years = listedYears(mountComponent({ month: 8, year: 2026 }, { availableYears: 10 }))

    expect(years).toEqual([...new Set(years)].sort((a, b) => a - b))
    expect(years).toHaveLength(11)
  })
})

describe('atalho "Hoje"', () => {
  it('não aparece quando o período é o mês atual', () => {
    expect(todayButton(mountComponent({ month: 8, year: 2026 })).exists()).toBe(false)
  })

  it.each([
    [{ month: 7, year: 2026 }, 'mês diferente no mesmo ano'],
    [{ month: 9, year: 2026 }, 'mês seguinte'],
    [{ month: 8, year: 2025 }, 'mesmo mês em outro ano'],
    [{ month: 12, year: 2030 }, 'período distante'],
  ])('aparece quando o período difere de hoje: %j (%s)', (period) => {
    const wrapper = mountComponent(period)

    expect(todayButton(wrapper).exists()).toBe(true)
    expect(todayButton(wrapper).text()).toContain('Hoje')
  })

  it('clicar emite o evento hoje, sem alterar o período por conta própria', async () => {
    const wrapper = mountComponent({ month: 3, year: 2025 })

    await todayButton(wrapper).trigger('click')

    expect(wrapper.emitted('today')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('some quando a navegação chega ao mês atual e volta quando sai dele', async () => {
    const wrapper = mountComponent({ month: 7, year: 2026 })
    expect(todayButton(wrapper).exists()).toBe(true)

    await next(wrapper).trigger('click')
    expect(todayButton(wrapper).exists()).toBe(false)

    await next(wrapper).trigger('click')
    expect(todayButton(wrapper).exists()).toBe(true)
  })

  it('usa o relógio (falso) para decidir o que é "hoje"', () => {
    vi.setSystemTime(new Date(2027, 2, 5, 12))

    expect(todayButton(mountComponent({ month: 3, year: 2027 })).exists()).toBe(false)
    expect(todayButton(mountComponent({ month: 8, year: 2026 })).exists()).toBe(true)
  })
})

describe('o mês nunca sai do intervalo 1–12', () => {
  it('navegar para frente e para trás a partir de qualquer mês só emite meses de 1 a 12', async () => {
    for (let month = 1; month <= 12; month += 1) {
      const wrapper = mountComponent({ month, year: 2026 })

      await previous(wrapper).trigger('click')
      await next(wrapper).trigger('click')
      await next(wrapper).trigger('click')

      for (const period of emittedPeriods(wrapper)) {
        expect(period.month).toBeGreaterThanOrEqual(1)
        expect(period.month).toBeLessThanOrEqual(12)
        expect(Number.isInteger(period.year)).toBe(true)
      }
    }
  })

  it('escolher qualquer mês pelo select emite apenas meses de 1 a 12', async () => {
    const wrapper = mountComponent({ month: 8, year: 2026 })

    for (let month = 1; month <= 12; month += 1) {
      await monthSelect(wrapper).setValue(String(month))
      expect(lastPeriod(wrapper)?.month).toBe(month)
    }
  })

  it('uma volta completa de 24 meses termina no mês de origem', async () => {
    const wrapper = mountComponent({ month: 5, year: 2026 })

    for (let i = 0; i < 24; i += 1) await next(wrapper).trigger('click')

    expect(lastPeriod(wrapper)).toEqual({ month: 5, year: 2028 })
    for (const period of emittedPeriods(wrapper)) {
      expect(period.month).toBeGreaterThanOrEqual(1)
      expect(period.month).toBeLessThanOrEqual(12)
    }
  })
})
