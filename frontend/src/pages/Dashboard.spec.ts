import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StatisticsChart from '@/components/features/StatisticsChart.vue'
import Dashboard from '@/pages/Dashboard.vue'
import { dashboardService } from '@/services/dashboardService'
import { saidaService } from '@/services/saidaService'
import type { DashboardResumo } from '@/types/dashboard'

vi.mock('@/services/dashboardService', () => ({
  dashboardService: { resumo: vi.fn() },
}))

vi.mock('@/services/saidaService', () => ({
  saidaService: { resumo: vi.fn() },
}))

const resumoMock = vi.mocked(dashboardService.resumo)
const saidaResumoMock = vi.mocked(saidaService.resumo)

const PONTOS = ['mar/26', 'abr/26', 'mai/26', 'jun/26', 'jul/26', 'ago/26']

function pontos(valores: number[]) {
  return PONTOS.map((label, indice) => ({ label, valor: valores[indice] ?? 0 }))
}

function resumo(sobrescritas: Partial<DashboardResumo> = {}): DashboardResumo {
  return {
    totalEntradas: 1000,
    totalSaidas: 350,
    saldo: 650,
    totalFaturas: 0,
    variacaoEntradas: 0,
    variacaoSaidas: 0,
    serieEntradas: pontos([0, 0, 0, 0, 0, 1000]),
    serieSaidas: pontos([0, 0, 0, 0, 0, 350]),
    gastosPorCategoria: [],
    entradasPorCategoria: [],
    transacoesRecentes: [],
    ...sobrescritas,
  }
}

const STUBS = { StatisticsChart: true, MonthPicker: true }

let wrapper: VueWrapper | undefined

async function montar(dados: DashboardResumo) {
  resumoMock.mockResolvedValue(dados)
  wrapper = mount(Dashboard, { global: { stubs: STUBS } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  saidaResumoMock.mockResolvedValue({
    total: 0,
    quantidade: 0,
    media: 0,
    totalPago: 0,
    totalPendente: 0,
    totalMesAnterior: 0,
    porCategoria: [],
    porTipo: [],
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.clearAllMocks()
})

describe('saldo do mês', () => {
  it('mostra a porcentagem já consumida das entradas', async () => {
    const tela = await montar(resumo())

    expect(tela.text()).toContain('35% consumido')
  })

  it('limita em 100% quando as saídas superam as entradas', async () => {
    const tela = await montar(resumo({ totalSaidas: 2500, saldo: -1500 }))

    expect(tela.text()).toContain('100% consumido')
  })

  it('mostra 0% sem saídas', async () => {
    const tela = await montar(resumo({ totalSaidas: 0, saldo: 1000 }))

    expect(tela.text()).toContain('0% consumido')
  })

  it('explica o caso sem entradas', async () => {
    const tela = await montar(resumo({ totalEntradas: 0, totalSaidas: 300, saldo: -300 }))

    expect(tela.text()).toContain('sem entradas no mês')
  })

  it('informa quando não há movimentação', async () => {
    const tela = await montar(resumo({ totalEntradas: 0, totalSaidas: 0, saldo: 0 }))

    expect(tela.text()).toContain('sem movimentações no mês')
  })

  it('não exibe mais o card "Comprometimento da renda"', async () => {
    const tela = await montar(resumo())

    expect(tela.text()).not.toContain('Comprometimento da renda')
  })
})

describe('gráfico de barras', () => {
  function seriesDaBarra(tela: VueWrapper) {
    const barra = tela
      .findAllComponents(StatisticsChart)
      .find((grafico) => grafico.props('tipo') === 'barra')

    return barra?.props('series')
  }

  it('separa entradas, saídas sem cartão e cartões', async () => {
    const tela = await montar(
      resumo({
        serieEntradas: pontos([0, 0, 0, 0, 600, 1500]),
        serieSaidas: pontos([0, 0, 0, 50, 400, 1200]),
        serieFaturas: pontos([0, 0, 0, 0, 100, 450]),
      }),
    )

    const series = seriesDaBarra(tela)

    expect(series?.map((serie: { nome: string }) => serie.nome)).toEqual(['Entradas', 'Saídas', 'Cartões'])
    expect(series?.[0].dados).toEqual([0, 0, 0, 0, 600, 1500])
    // A fatura já está somada nas saídas: é subtraída para não aparecer duas vezes.
    expect(series?.[1].dados).toEqual([0, 0, 0, 50, 300, 750])
    expect(series?.[2].dados).toEqual([0, 0, 0, 0, 100, 450])
  })

  it('trata backend sem serieFaturas como sem cartão', async () => {
    const tela = await montar(resumo({ serieSaidas: pontos([0, 0, 0, 0, 0, 350]) }))

    const series = seriesDaBarra(tela)

    expect(series?.[1].dados).toEqual([0, 0, 0, 0, 0, 350])
    expect(series?.[2].dados).toEqual([0, 0, 0, 0, 0, 0])
  })
})

describe('gráficos', () => {
  it('mostra o gráfico de linha de acompanhamento junto dos demais', async () => {
    saidaResumoMock.mockResolvedValue({
      total: 100,
      quantidade: 1,
      media: 100,
      totalPago: 0,
      totalPendente: 100,
      totalMesAnterior: 0,
      porCategoria: [],
      porTipo: [{ tipo: 'CONTA', total: 100 }],
    })
    const categoria = [{ nome: 'Casa', cor: '#6366f1', total: 100 }]
    const tela = await montar(resumo({ gastosPorCategoria: categoria, entradasPorCategoria: categoria }))

    const tipos = tela.findAllComponents(StatisticsChart).map((grafico) => grafico.props('tipo'))

    expect(tipos).toEqual(['barra', 'linha', 'rosca', 'rosca', 'rosca'])
  })
})

/** Seletor Saídas/Cartões de um card (`tipo` ou `categoria`), pelo `data-testid`. */
function seletorOrigem(tela: VueWrapper, card: 'tipo' | 'categoria') {
  return tela.get(`[data-testid="origem-gastos-por-${card}"]`)
}

function botaoOrigem(tela: VueWrapper, card: 'tipo' | 'categoria', rotulo: string) {
  const encontrado = seletorOrigem(tela, card)
    .findAll('button')
    .find((item) => item.text() === rotulo)
  if (!encontrado) throw new Error(`Botão "${rotulo}" não encontrado`)
  return encontrado
}

/** Rótulos do gráfico que fica no mesmo card do seletor Saídas/Cartões. */
function labelsDoCard(tela: VueWrapper, card: 'tipo' | 'categoria'): string[] | undefined {
  const secao = seletorOrigem(tela, card).element.closest('section')
  return tela
    .findAllComponents(StatisticsChart)
    .find((grafico) => secao?.contains(grafico.element))
    ?.props('labels')
}

describe('gastos por tipo', () => {
  const botao = (tela: VueWrapper, rotulo: string) => botaoOrigem(tela, 'tipo', rotulo)
  const labelsDoGrafico = (tela: VueWrapper) => labelsDoCard(tela, 'tipo')

  beforeEach(() => {
    saidaResumoMock.mockResolvedValue({
      total: 300,
      quantidade: 2,
      media: 150,
      totalPago: 0,
      totalPendente: 300,
      totalMesAnterior: 0,
      porCategoria: [],
      porTipo: [
        { tipo: 'CONTA', total: 200 },
        { tipo: 'TRANSPORTE', total: 100 },
      ],
    })
  })

  it('começa em Saídas, plotando os gastos das saídas por tipo', async () => {
    const tela = await montar(resumo({ gastosCartoesPorTipo: [{ tipo: 'LAZER', total: 80 }] }))

    expect(botao(tela, 'Saídas').attributes('aria-pressed')).toBe('true')
    expect(botao(tela, 'Cartões').attributes('aria-pressed')).toBe('false')
    expect(labelsDoGrafico(tela)).toEqual(['Conta', 'Transporte'])
  })

  it('alterna para os gastos de cartão no mesmo gráfico, com um só botão ativo', async () => {
    const tela = await montar(
      resumo({
        gastosCartoesPorTipo: [
          { tipo: 'LAZER', total: 80 },
          { tipo: 'ALIMENTACAO', total: 40 },
        ],
      }),
    )

    await botao(tela, 'Cartões').trigger('click')

    expect(botao(tela, 'Cartões').attributes('aria-pressed')).toBe('true')
    expect(botao(tela, 'Saídas').attributes('aria-pressed')).toBe('false')
    expect(labelsDoGrafico(tela)).toEqual(['Lazer', 'Alimentação'])

    await botao(tela, 'Saídas').trigger('click')

    expect(botao(tela, 'Saídas').attributes('aria-pressed')).toBe('true')
    expect(labelsDoGrafico(tela)).toEqual(['Conta', 'Transporte'])
  })

  it('mostra estado vazio de cartão quando não há gastos no cartão (ou o backend não manda o campo)', async () => {
    const tela = await montar(resumo())

    await botao(tela, 'Cartões').trigger('click')

    expect(tela.text()).toContain('Sem gastos no cartão')
    expect(labelsDoGrafico(tela)).toBeUndefined()
  })
})

describe('gastos por categoria', () => {
  const botao = (tela: VueWrapper, rotulo: string) => botaoOrigem(tela, 'categoria', rotulo)
  const labelsDoGrafico = (tela: VueWrapper) => labelsDoCard(tela, 'categoria')

  const dados = resumo({
    gastosPorCategoria: [
      { nome: 'Despesa Variável', cor: '#14b8a6', total: 300 },
      { nome: 'Despesa Fixa', cor: '#6366f1', total: 50 },
    ],
    gastosCartoesPorCategoria: [
      { nome: 'Despesa Fixa', cor: '#6366f1', total: 90 },
      { nome: 'Investimento', cor: '#0891b2', total: 20 },
    ],
  })

  it('começa em Saídas, plotando os gastos das saídas por categoria', async () => {
    const tela = await montar(dados)

    expect(botao(tela, 'Saídas').attributes('aria-pressed')).toBe('true')
    expect(botao(tela, 'Cartões').attributes('aria-pressed')).toBe('false')
    expect(labelsDoGrafico(tela)).toEqual(['Despesa Variável', 'Despesa Fixa'])
  })

  it('alterna para os gastos de cartão por categoria, com um só botão ativo', async () => {
    const tela = await montar(dados)

    await botao(tela, 'Cartões').trigger('click')

    expect(botao(tela, 'Cartões').attributes('aria-pressed')).toBe('true')
    expect(botao(tela, 'Saídas').attributes('aria-pressed')).toBe('false')
    expect(labelsDoGrafico(tela)).toEqual(['Despesa Fixa', 'Investimento'])

    await botao(tela, 'Saídas').trigger('click')

    expect(labelsDoGrafico(tela)).toEqual(['Despesa Variável', 'Despesa Fixa'])
  })

  it('não mexe no gráfico de gastos por tipo ao alternar', async () => {
    const tela = await montar(dados)

    await botao(tela, 'Cartões').trigger('click')

    expect(botaoOrigem(tela, 'tipo', 'Saídas').attributes('aria-pressed')).toBe('true')
  })

  it('mostra estado vazio de cartão quando o backend não manda o campo', async () => {
    const tela = await montar(resumo({ gastosPorCategoria: dados.gastosPorCategoria }))

    await botao(tela, 'Cartões').trigger('click')

    expect(tela.text()).toContain('Sem gastos no cartão')
    expect(labelsDoGrafico(tela)).toBeUndefined()
  })
})

describe('painel de últimas transações', () => {
  function botao(tela: VueWrapper) {
    return tela.get('button[aria-controls="painel-ultimas-transacoes"]')
  }

  function painelVisivel(tela: VueWrapper): boolean {
    const painel = tela.get('[data-testid="painel-ultimas-transacoes"]')
    return painel.element.parentElement?.getAttribute('aria-hidden') === 'false'
  }

  it('começa oculto', async () => {
    const tela = await montar(resumo())

    expect(botao(tela).attributes('aria-expanded')).toBe('false')
    expect(painelVisivel(tela)).toBe(false)
  })

  it('abre e fecha ao clicar no botão', async () => {
    const tela = await montar(resumo())

    await botao(tela).trigger('click')
    expect(botao(tela).attributes('aria-expanded')).toBe('true')
    expect(painelVisivel(tela)).toBe(true)

    await botao(tela).trigger('click')
    expect(botao(tela).attributes('aria-expanded')).toBe('false')
    expect(painelVisivel(tela)).toBe(false)
  })

  it('fecha com a tecla Esc', async () => {
    const tela = await montar(resumo())
    await botao(tela).trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await tela.vm.$nextTick()

    expect(painelVisivel(tela)).toBe(false)
  })

  it('o botão tem só ícone, com nome acessível', async () => {
    const tela = await montar(resumo())

    expect(botao(tela).text()).toBe('')
    expect(botao(tela).attributes('aria-label')).toBe('Últimas transações')
  })
})
