import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MonthPicker from '@/components/features/MonthPicker.vue'
import type { Periodo } from '@/types/common'

type Props = InstanceType<typeof MonthPicker>['$props']

const MESES = [
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
function montar(modelValue: Periodo, props: Partial<Props> = {}) {
  const wrapper: VueWrapper = mount(MonthPicker, {
    props: {
      modelValue,
      'onUpdate:modelValue': (periodo: Periodo) => wrapper.setProps({ modelValue: periodo }),
      ...props,
    } as Props,
  })
  return wrapper
}

const anterior = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Mês anterior"]')
const proximo = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Próximo mês"]')
const seletorMes = (wrapper: VueWrapper) => wrapper.get('select#seletor-mes')
const seletorAno = (wrapper: VueWrapper) => wrapper.get('select#seletor-ano')
const botaoHoje = (wrapper: VueWrapper) => wrapper.find('button[title="Voltar para o mês atual"]')

const periodosEmitidos = (wrapper: VueWrapper) =>
  (wrapper.emitted('update:modelValue') ?? []).map(([periodo]) => periodo as Periodo)
const ultimoPeriodo = (wrapper: VueWrapper) => periodosEmitidos(wrapper).at(-1)

const anosDaLista = (wrapper: VueWrapper) =>
  seletorAno(wrapper)
    .findAll('option')
    .map((opcao) => Number(opcao.attributes('value')))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 7, 15, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('botões anterior e próximo', () => {
  it('próximo avança um mês', async () => {
    const wrapper = montar({ mes: 8, ano: 2026 })

    await proximo(wrapper).trigger('click')

    expect(ultimoPeriodo(wrapper)).toEqual({ mes: 9, ano: 2026 })
  })

  it('anterior volta um mês', async () => {
    const wrapper = montar({ mes: 8, ano: 2026 })

    await anterior(wrapper).trigger('click')

    expect(ultimoPeriodo(wrapper)).toEqual({ mes: 7, ano: 2026 })
  })

  it('de dezembro, próximo vai para janeiro do ano seguinte', async () => {
    const wrapper = montar({ mes: 12, ano: 2026 })

    await proximo(wrapper).trigger('click')

    expect(ultimoPeriodo(wrapper)).toEqual({ mes: 1, ano: 2027 })
  })

  it('de janeiro, anterior vai para dezembro do ano anterior', async () => {
    const wrapper = montar({ mes: 1, ano: 2026 })

    await anterior(wrapper).trigger('click')

    expect(ultimoPeriodo(wrapper)).toEqual({ mes: 12, ano: 2025 })
  })

  it('cliques em sequência acumulam a navegação', async () => {
    const wrapper = montar({ mes: 11, ano: 2026 })

    await proximo(wrapper).trigger('click')
    await proximo(wrapper).trigger('click')
    await proximo(wrapper).trigger('click')

    expect(periodosEmitidos(wrapper)).toEqual([
      { mes: 12, ano: 2026 },
      { mes: 1, ano: 2027 },
      { mes: 2, ano: 2027 },
    ])
  })

  it('não altera o objeto de período recebido', async () => {
    const original = { mes: 12, ano: 2026 }
    const wrapper = montar(original)

    await proximo(wrapper).trigger('click')

    expect(original).toEqual({ mes: 12, ano: 2026 })
  })
})

describe('selects de mês e ano', () => {
  it('trocar o mês emite o novo período mantendo o ano', async () => {
    const wrapper = montar({ mes: 8, ano: 2026 })

    await seletorMes(wrapper).setValue('3')

    expect(ultimoPeriodo(wrapper)).toEqual({ mes: 3, ano: 2026 })
  })

  it('trocar o ano emite o novo período mantendo o mês', async () => {
    const wrapper = montar({ mes: 8, ano: 2026 })

    await seletorAno(wrapper).setValue('2024')

    expect(ultimoPeriodo(wrapper)).toEqual({ mes: 8, ano: 2024 })
  })

  it('o valor emitido é numérico, nunca texto', async () => {
    const wrapper = montar({ mes: 8, ano: 2026 })

    await seletorMes(wrapper).setValue('5')
    await seletorAno(wrapper).setValue('2025')

    for (const periodo of periodosEmitidos(wrapper)) {
      expect(typeof periodo.mes).toBe('number')
      expect(typeof periodo.ano).toBe('number')
    }
    expect(ultimoPeriodo(wrapper)).toEqual({ mes: 5, ano: 2025 })
  })

  it('mostra o período atual selecionado nos dois selects', () => {
    const wrapper = montar({ mes: 3, ano: 2025 })

    expect((seletorMes(wrapper).element as HTMLSelectElement).value).toBe('3')
    expect((seletorAno(wrapper).element as HTMLSelectElement).value).toBe('2025')
  })

  it('acompanha o período quando ele muda por fora', async () => {
    const wrapper = montar({ mes: 8, ano: 2026 })

    await wrapper.setProps({ modelValue: { mes: 1, ano: 2024 } })

    expect((seletorMes(wrapper).element as HTMLSelectElement).value).toBe('1')
    expect((seletorAno(wrapper).element as HTMLSelectElement).value).toBe('2024')
  })

  it('a lista de meses tem os 12 meses, de Janeiro a Dezembro, com valores 1 a 12', () => {
    const opcoes = seletorMes(montar({ mes: 8, ano: 2026 })).findAll('option')

    expect(opcoes.map((opcao) => opcao.text())).toEqual(MESES)
    expect(opcoes.map((opcao) => Number(opcao.attributes('value')))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('os selects têm rótulos acessíveis', () => {
    const wrapper = montar({ mes: 8, ano: 2026 })

    expect(wrapper.get('label[for="seletor-mes"]').text()).toBe('Mês')
    expect(wrapper.get('label[for="seletor-ano"]').text()).toBe('Ano')
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Selecionar período')
  })
})

describe('lista de anos', () => {
  it('padrão: 4 anos anteriores, o ano atual e o próximo (relógio em 2026)', () => {
    expect(anosDaLista(montar({ mes: 8, ano: 2026 }))).toEqual([2022, 2023, 2024, 2025, 2026, 2027])
  })

  it('anosDisponiveis customizado altera o tamanho da janela', () => {
    expect(anosDaLista(montar({ mes: 8, ano: 2026 }, { anosDisponiveis: 3 }))).toEqual([2024, 2025, 2026, 2027])
    expect(anosDaLista(montar({ mes: 8, ano: 2026 }, { anosDisponiveis: 1 }))).toEqual([2026, 2027])
  })

  it('a janela é ancorada no ano de hoje, não no período selecionado', () => {
    expect(anosDaLista(montar({ mes: 1, ano: 2024 }))).toEqual([2022, 2023, 2024, 2025, 2026, 2027])
  })

  it('acompanha o relógio no momento da montagem', () => {
    vi.setSystemTime(new Date(2030, 0, 10, 12))

    expect(anosDaLista(montar({ mes: 1, ano: 2030 }))).toEqual([2026, 2027, 2028, 2029, 2030, 2031])
  })

  it('a lista está em ordem crescente e sem repetições', () => {
    const anos = anosDaLista(montar({ mes: 8, ano: 2026 }, { anosDisponiveis: 10 }))

    expect(anos).toEqual([...new Set(anos)].sort((a, b) => a - b))
    expect(anos).toHaveLength(11)
  })
})

describe('atalho "Hoje"', () => {
  it('não aparece quando o período é o mês atual', () => {
    expect(botaoHoje(montar({ mes: 8, ano: 2026 })).exists()).toBe(false)
  })

  it.each([
    [{ mes: 7, ano: 2026 }, 'mês diferente no mesmo ano'],
    [{ mes: 9, ano: 2026 }, 'mês seguinte'],
    [{ mes: 8, ano: 2025 }, 'mesmo mês em outro ano'],
    [{ mes: 12, ano: 2030 }, 'período distante'],
  ])('aparece quando o período difere de hoje: %j (%s)', (periodo) => {
    const wrapper = montar(periodo)

    expect(botaoHoje(wrapper).exists()).toBe(true)
    expect(botaoHoje(wrapper).text()).toContain('Hoje')
  })

  it('clicar emite o evento hoje, sem alterar o período por conta própria', async () => {
    const wrapper = montar({ mes: 3, ano: 2025 })

    await botaoHoje(wrapper).trigger('click')

    expect(wrapper.emitted('hoje')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('some quando a navegação chega ao mês atual e volta quando sai dele', async () => {
    const wrapper = montar({ mes: 7, ano: 2026 })
    expect(botaoHoje(wrapper).exists()).toBe(true)

    await proximo(wrapper).trigger('click')
    expect(botaoHoje(wrapper).exists()).toBe(false)

    await proximo(wrapper).trigger('click')
    expect(botaoHoje(wrapper).exists()).toBe(true)
  })

  it('usa o relógio (falso) para decidir o que é "hoje"', () => {
    vi.setSystemTime(new Date(2027, 2, 5, 12))

    expect(botaoHoje(montar({ mes: 3, ano: 2027 })).exists()).toBe(false)
    expect(botaoHoje(montar({ mes: 8, ano: 2026 })).exists()).toBe(true)
  })
})

describe('o mês nunca sai do intervalo 1–12', () => {
  it('navegar para frente e para trás a partir de qualquer mês só emite meses de 1 a 12', async () => {
    for (let mes = 1; mes <= 12; mes += 1) {
      const wrapper = montar({ mes, ano: 2026 })

      await anterior(wrapper).trigger('click')
      await proximo(wrapper).trigger('click')
      await proximo(wrapper).trigger('click')

      for (const periodo of periodosEmitidos(wrapper)) {
        expect(periodo.mes).toBeGreaterThanOrEqual(1)
        expect(periodo.mes).toBeLessThanOrEqual(12)
        expect(Number.isInteger(periodo.ano)).toBe(true)
      }
    }
  })

  it('escolher qualquer mês pelo select emite apenas meses de 1 a 12', async () => {
    const wrapper = montar({ mes: 8, ano: 2026 })

    for (let mes = 1; mes <= 12; mes += 1) {
      await seletorMes(wrapper).setValue(String(mes))
      expect(ultimoPeriodo(wrapper)?.mes).toBe(mes)
    }
  })

  it('uma volta completa de 24 meses termina no mês de origem', async () => {
    const wrapper = montar({ mes: 5, ano: 2026 })

    for (let i = 0; i < 24; i += 1) await proximo(wrapper).trigger('click')

    expect(ultimoPeriodo(wrapper)).toEqual({ mes: 5, ano: 2028 })
    for (const periodo of periodosEmitidos(wrapper)) {
      expect(periodo.mes).toBeGreaterThanOrEqual(1)
      expect(periodo.mes).toBeLessThanOrEqual(12)
    }
  })
})
