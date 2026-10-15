import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { dashboardService } from '@/services/dashboardService'
import { expenseService } from '@/services/expenseService'
import { getErrorMessage } from '@/services/http'
import type { DashboardSummary } from '@/types/dashboard'
import type { ExpenseSummary } from '@/types/expense'
import { usePeriodStore } from './periodStore'

export const useDashboardStore = defineStore('dashboard', () => {
  const periodStore = usePeriodStore()

  const summary = ref<DashboardSummary | null>(null)
  /** Distribuição das saídas por tipo — vem de `/saidas/resumo`, não do resumo do dashboard. */
  const expensesByType = ref<ExpenseSummary['byType']>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isBalancePositive = computed(() => (summary.value?.balance ?? 0) >= 0)

  /** Percentual da renda já comprometido com despesas (0-100). */
  const incomeCommitment = computed(() => {
    const { totalIncome = 0, totalExpenses = 0 } = summary.value ?? {}
    if (!totalIncome) return totalExpenses > 0 ? 100 : 0
    return Math.min(100, (totalExpenses / totalIncome) * 100)
  })

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const period = periodStore.period
      const [dashboard, expenses] = await Promise.all([
        dashboardService.summary(period),
        expenseService.summary(period),
      ])
      summary.value = dashboard
      expensesByType.value = expenses.byType ?? []
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível carregar o resumo financeiro.')
      summary.value = null
      expensesByType.value = []
    } finally {
      loading.value = false
    }
  }

  return { summary, expensesByType, loading, error, isBalancePositive, incomeCommitment, load }
})
