import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Period } from '@/types/common'
import { addMonths, currentPeriod, formatPeriod, isSamePeriod } from '@/utils/dateFormatter'

/**
 * Mês de competência selecionado, compartilhado por todas as páginas: trocar o
 * período no Dashboard mantém a mesma competência ao navegar para Entradas.
 */
export const usePeriodStore = defineStore('period', () => {
  const period = ref<Period>(currentPeriod())

  const label = computed(() => formatPeriod(period.value))
  const isCurrentMonth = computed(() => isSamePeriod(period.value, currentPeriod()))

  function set(value: Period): void {
    period.value = { ...value }
  }

  function next(amount = 1): void {
    period.value = addMonths(period.value, amount)
  }

  function previous(amount = 1): void {
    period.value = addMonths(period.value, -amount)
  }

  function goToToday(): void {
    period.value = currentPeriod()
  }

  return { period, label, isCurrentMonth, set, next, previous, goToToday }
})
