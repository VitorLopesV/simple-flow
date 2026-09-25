import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { dashboardService } from '@/services/dashboardService'
import { mensagemDeErro } from '@/services/http'
import { saidaService } from '@/services/saidaService'
import type { DashboardResumo } from '@/types/dashboard'
import type { SaidaResumo } from '@/types/saida'
import { usePeriodoStore } from './periodoStore'

export const useDashboardStore = defineStore('dashboard', () => {
  const periodoStore = usePeriodoStore()

  const resumo = ref<DashboardResumo | null>(null)
  /** Distribuição das saídas por tipo — vem de `/saidas/resumo`, não do resumo do dashboard. */
  const gastosPorTipo = ref<SaidaResumo['porTipo']>([])
  const loading = ref(false)
  const erro = ref<string | null>(null)

  const saldoPositivo = computed(() => (resumo.value?.saldo ?? 0) >= 0)

  /** Percentual da renda já comprometido com despesas (0-100). */
  const comprometimento = computed(() => {
    const { totalEntradas = 0, totalSaidas = 0 } = resumo.value ?? {}
    if (!totalEntradas) return totalSaidas > 0 ? 100 : 0
    return Math.min(100, (totalSaidas / totalEntradas) * 100)
  })

  async function carregar(): Promise<void> {
    loading.value = true
    erro.value = null
    try {
      const periodo = periodoStore.periodo
      const [dashboard, saidas] = await Promise.all([
        dashboardService.resumo(periodo),
        saidaService.resumo(periodo),
      ])
      resumo.value = dashboard
      gastosPorTipo.value = saidas.porTipo ?? []
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível carregar o resumo financeiro.')
      resumo.value = null
      gastosPorTipo.value = []
    } finally {
      loading.value = false
    }
  }

  return { resumo, gastosPorTipo, loading, erro, saldoPositivo, comprometimento, carregar }
})
