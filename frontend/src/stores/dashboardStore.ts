import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { dashboardService } from '@/services/dashboardService'
import { mensagemDeErro } from '@/services/http'
import type { DashboardResumo } from '@/types/dashboard'
import { usePeriodoStore } from './periodoStore'

export const useDashboardStore = defineStore('dashboard', () => {
  const periodoStore = usePeriodoStore()

  const resumo = ref<DashboardResumo | null>(null)
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
      resumo.value = await dashboardService.resumo(periodoStore.periodo)
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível carregar o resumo financeiro.')
      resumo.value = null
    } finally {
      loading.value = false
    }
  }

  return { resumo, loading, erro, saldoPositivo, comprometimento, carregar }
})
