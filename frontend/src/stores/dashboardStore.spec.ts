import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dashboardService } from '@/services/dashboardService'
import { saidaService } from '@/services/saidaService'
import { useDashboardStore } from '@/stores/dashboardStore'
import { usePeriodoStore } from '@/stores/periodoStore'
import type { DashboardResumo } from '@/types/dashboard'
import type { SaidaResumo } from '@/types/saida'

vi.mock('@/services/dashboardService', () => ({
  dashboardService: { resumo: vi.fn() },
}))

vi.mock('@/services/saidaService', () => ({
  saidaService: { resumo: vi.fn() },
}))

const resumoMock = vi.mocked(dashboardService.resumo)
const saidaResumoMock = vi.mocked(saidaService.resumo)

function saidaResumo(sobrescritas: Partial<SaidaResumo> = {}): SaidaResumo {
  return {
    total: 0,
    quantidade: 0,
    media: 0,
    totalPago: 0,
    totalPendente: 0,
    totalMesAnterior: 0,
    porCategoria: [],
    porTipo: [],
    ...sobrescritas,
  }
}

function resumo(sobrescritas: Partial<DashboardResumo> = {}): DashboardResumo {
  return {
    totalEntradas: 1000,
    totalSaidas: 400,
    saldo: 600,
    totalFaturas: 0,
    variacaoEntradas: 0,
    variacaoSaidas: 0,
    serieEntradas: [],
    serieSaidas: [],
    gastosPorCategoria: [],
    entradasPorCategoria: [],
    transacoesRecentes: [],
    ...sobrescritas,
  }
}

/** Store carregado com o resumo informado. */
async function storeCom(dados: Partial<DashboardResumo>) {
  resumoMock.mockResolvedValue(resumo(dados))
  const store = useDashboardStore()
  await store.carregar()
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  resumoMock.mockReset()
  resumoMock.mockResolvedValue(resumo())
  saidaResumoMock.mockReset()
  saidaResumoMock.mockResolvedValue(saidaResumo())
})

describe('carregar', () => {
  it('preenche gastosPorTipo com o porTipo do resumo de saídas do mesmo período', async () => {
    usePeriodoStore().definir({ mes: 3, ano: 2025 })
    saidaResumoMock.mockResolvedValue(
      saidaResumo({ porTipo: [{ tipo: 'LAZER', total: 50 }] }),
    )
    const store = useDashboardStore()

    await store.carregar()

    expect(saidaResumoMock).toHaveBeenCalledWith({ mes: 3, ano: 2025 })
    expect(store.gastosPorTipo).toEqual([{ tipo: 'LAZER', total: 50 }])
  })

  it('trata ausência de porTipo (backend antigo) como lista vazia', async () => {
    saidaResumoMock.mockResolvedValue({ ...saidaResumo(), porTipo: undefined } as never)
    const store = useDashboardStore()

    await store.carregar()

    expect(store.gastosPorTipo).toEqual([])
  })

  it('chama o service com o período do periodoStore e preenche o resumo', async () => {
    usePeriodoStore().definir({ mes: 3, ano: 2025 })
    const esperado = resumo({ totalEntradas: 123 })
    resumoMock.mockResolvedValue(esperado)
    const store = useDashboardStore()

    await store.carregar()

    expect(resumoMock).toHaveBeenCalledTimes(1)
    expect(resumoMock).toHaveBeenCalledWith({ mes: 3, ano: 2025 })
    expect(store.resumo).toEqual(esperado)
    expect(store.erro).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('usa o período vigente a cada chamada', async () => {
    const periodo = usePeriodoStore()
    const store = useDashboardStore()
    periodo.definir({ mes: 1, ano: 2026 })
    await store.carregar()

    periodo.avancar()
    await store.carregar()

    expect(resumoMock).toHaveBeenNthCalledWith(1, { mes: 1, ano: 2026 })
    expect(resumoMock).toHaveBeenNthCalledWith(2, { mes: 2, ano: 2026 })
  })

  it('mantém loading verdadeiro enquanto a chamada está em andamento', async () => {
    let concluir!: (dados: DashboardResumo) => void
    resumoMock.mockReturnValue(new Promise<DashboardResumo>((resolve) => (concluir = resolve)))
    const store = useDashboardStore()

    const promessa = store.carregar()
    expect(store.loading).toBe(true)

    concluir(resumo())
    await promessa

    expect(store.loading).toBe(false)
  })

  it('falha: preenche erro, zera o resumo e desliga o loading', async () => {
    const store = await storeCom({ totalEntradas: 500 })
    expect(store.resumo).not.toBeNull()
    resumoMock.mockRejectedValue(new Error('Servidor fora do ar'))

    await store.carregar()

    expect(store.erro).toBe('Servidor fora do ar')
    expect(store.resumo).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    resumoMock.mockRejectedValue('quebrou')
    const store = useDashboardStore()

    await store.carregar()

    expect(store.erro).toBe('Não foi possível carregar o resumo financeiro.')
  })

  it('uma nova tentativa bem-sucedida limpa o erro', async () => {
    resumoMock.mockRejectedValueOnce(new Error('falhou'))
    const store = useDashboardStore()
    await store.carregar()
    expect(store.erro).toBe('falhou')

    await store.carregar()

    expect(store.erro).toBeNull()
    expect(store.resumo).toEqual(resumo())
  })
})

describe('saldoPositivo', () => {
  it('é verdadeiro para saldo positivo', async () => {
    expect((await storeCom({ saldo: 100 })).saldoPositivo).toBe(true)
  })

  it('é verdadeiro para saldo zero', async () => {
    expect((await storeCom({ saldo: 0 })).saldoPositivo).toBe(true)
  })

  it('é falso para saldo negativo', async () => {
    expect((await storeCom({ saldo: -0.01 })).saldoPositivo).toBe(false)
  })

  it('é verdadeiro sem resumo', () => {
    expect(useDashboardStore().saldoPositivo).toBe(true)
  })
})

describe('comprometimento', () => {
  it('calcula saídas sobre entradas em percentual', async () => {
    expect((await storeCom({ totalEntradas: 1000, totalSaidas: 250 })).comprometimento).toBe(25)
  })

  it('aceita frações', async () => {
    expect((await storeCom({ totalEntradas: 3, totalSaidas: 1 })).comprometimento).toBeCloseTo(33.333, 2)
  })

  it('é exatamente 100 quando saídas igualam entradas', async () => {
    expect((await storeCom({ totalEntradas: 1000, totalSaidas: 1000 })).comprometimento).toBe(100)
  })

  it('é limitado a 100 quando as saídas superam as entradas', async () => {
    expect((await storeCom({ totalEntradas: 1000, totalSaidas: 2500 })).comprometimento).toBe(100)
  })

  it('é 100 com entradas 0 e saídas maiores que 0, sem Infinity', async () => {
    const { comprometimento } = await storeCom({ totalEntradas: 0, totalSaidas: 300 })

    expect(comprometimento).toBe(100)
    expect(Number.isFinite(comprometimento)).toBe(true)
  })

  it('é 0 com entradas e saídas 0, sem NaN', async () => {
    const { comprometimento } = await storeCom({ totalEntradas: 0, totalSaidas: 0 })

    expect(comprometimento).toBe(0)
    expect(Number.isNaN(comprometimento)).toBe(false)
  })

  it('é 0 sem resumo', () => {
    expect(useDashboardStore().comprometimento).toBe(0)
  })

  it('volta a 0 depois de uma falha que zera o resumo', async () => {
    const store = await storeCom({ totalEntradas: 1000, totalSaidas: 500 })
    expect(store.comprometimento).toBe(50)
    resumoMock.mockRejectedValue(new Error('falhou'))

    await store.carregar()

    expect(store.comprometimento).toBe(0)
    expect(store.saldoPositivo).toBe(true)
  })
})
