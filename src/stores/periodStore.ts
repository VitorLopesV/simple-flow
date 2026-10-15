import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { periodService } from '@/services/periodService'
import type { Period } from '@/types/common'
import type { NavigationLimits } from '@/types/period'
import {
  addMonths,
  clampPeriod,
  comparePeriods,
  currentPeriod,
  formatPeriod,
  isSamePeriod,
} from '@/utils/dateFormatter'

/**
 * Mês de competência selecionado, compartilhado por todas as páginas: trocar o
 * período no Dashboard mantém a mesma competência ao navegar para Entradas.
 *
 * A navegação é limitada: no máximo o mês atual +1 e, no passado, o primeiro mês com
 * dados do usuário (`limits`, vindo da API). Enquanto os limites não chegam — ou se a
 * API falhar — só o teto vale, porque ele não depende dos dados do usuário.
 */
export const usePeriodStore = defineStore('period', () => {
  const period = ref<Period>(currentPeriod())
  const limits = ref<NavigationLimits | null>(null)

  const label = computed(() => formatPeriod(period.value))
  const isCurrentMonth = computed(() => isSamePeriod(period.value, currentPeriod()))

  const minPeriod = computed<Period | null>(() => limits.value?.firstMonth ?? null)
  const maxPeriod = computed<Period>(() => limits.value?.lastMonth ?? addMonths(currentPeriod(), 1))

  const canGoBack = computed(
    () => !minPeriod.value || comparePeriods(period.value, minPeriod.value) > 0,
  )
  const canGoForward = computed(() => comparePeriods(period.value, maxPeriod.value) < 0)

  function clamp(value: Period): Period {
    return clampPeriod(value, minPeriod.value, maxPeriod.value)
  }

  // Rede de segurança para quem escreve direto em `period` (o `v-model` do MonthPicker):
  // um mês fora do intervalo nunca chega às páginas.
  watch(
    period,
    (value) => {
      const allowed = clamp(value)
      if (!isSamePeriod(allowed, value)) period.value = allowed
    },
    { flush: 'sync' },
  )

  function set(value: Period): void {
    period.value = clamp(value)
  }

  function next(amount = 1): void {
    period.value = clamp(addMonths(period.value, amount))
  }

  function previous(amount = 1): void {
    period.value = clamp(addMonths(period.value, -amount))
  }

  function goToToday(): void {
    period.value = clamp(currentPeriod())
  }

  /**
   * Busca o intervalo navegável e traz o período selecionado para dentro dele. Chamado
   * ao abrir a área logada e depois de lançamentos, que podem antecipar o primeiro mês.
   */
  async function loadLimits(): Promise<void> {
    try {
      limits.value = await periodService.limits()
      period.value = clamp(period.value)
    } catch {
      // Sem os limites, a navegação segue só com o teto (mês atual +1): não bloqueia a tela.
    }
  }

  return {
    period,
    limits,
    label,
    isCurrentMonth,
    minPeriod,
    maxPeriod,
    canGoBack,
    canGoForward,
    set,
    next,
    previous,
    goToToday,
    loadLimits,
  }
})
