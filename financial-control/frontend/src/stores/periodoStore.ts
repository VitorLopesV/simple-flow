import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Periodo } from '@/types/common'
import { addMeses, formatPeriodo, mesmoPeriodo, periodoAtual } from '@/utils/dateFormatter'

/**
 * Mês de competência selecionado, compartilhado por todas as páginas: trocar o
 * período no Dashboard mantém a mesma competência ao navegar para Entradas.
 */
export const usePeriodoStore = defineStore('periodo', () => {
  const periodo = ref<Periodo>(periodoAtual())

  const rotulo = computed(() => formatPeriodo(periodo.value))
  const ehMesAtual = computed(() => mesmoPeriodo(periodo.value, periodoAtual()))

  function definir(novo: Periodo): void {
    periodo.value = { ...novo }
  }

  function avancar(quantidade = 1): void {
    periodo.value = addMeses(periodo.value, quantidade)
  }

  function voltar(quantidade = 1): void {
    periodo.value = addMeses(periodo.value, -quantidade)
  }

  function irParaHoje(): void {
    periodo.value = periodoAtual()
  }

  return { periodo, rotulo, ehMesAtual, definir, avancar, voltar, irParaHoje }
})
