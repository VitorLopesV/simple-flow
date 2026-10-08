<script setup lang="ts">
import { ChartPie } from '@lucide/vue'
import { computed, ref } from 'vue'

import BaseCard from '@/components/common/BaseCard.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import BaseToggleGroup, { type ToggleOption } from '@/components/common/BaseToggleGroup.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import StatisticsChart from '@/components/features/StatisticsChart.vue'
import { useCategoryStore } from '@/stores/categoryStore'
import type { CardTransaction } from '@/types/creditCard'
import { EXPENSE_TYPE_COLOR, EXPENSE_TYPE_LABEL, type ExpenseType } from '@/types/expense'
import { formatCurrency } from '@/utils/currencyFormatter'

export type InvoiceSpendingView = 'category' | 'type'

const props = withDefaults(
  defineProps<{
    /** Transações da fatura inteira — sem os filtros da tabela, para a soma bater com o total. */
    transactions: CardTransaction[]
    description?: string
    loading?: boolean
  }>(),
  { description: '', loading: false },
)

const categoryStore = useCategoryStore()

const VIEW_OPTIONS: ToggleOption<InvoiceSpendingView>[] = [
  { value: 'category', label: 'Categoria', title: 'Gastos por categoria' },
  { value: 'type', label: 'Tipo', title: 'Gastos por tipo' },
]

const view = ref<InvoiceSpendingView>('category')

/**
 * Uma fatia por categoria ou por tipo, da maior para a menor. Sem corte das menores
 * (diferente da Dashboard): a soma das fatias precisa bater com o total da fatura.
 * Nome e cor vêm das mesmas fontes da Dashboard, então as cores coincidem.
 */
const slices = computed(() => {
  const grouped = new Map<string, number>()
  for (const transaction of props.transactions) {
    const key = view.value === 'category' ? transaction.categoryId : transaction.type
    grouped.set(key, (grouped.get(key) ?? 0) + transaction.amount)
  }

  return [...grouped.entries()]
    .map(([key, total]) => ({
      ...(view.value === 'category'
        ? { label: categoryStore.name(key), color: categoryStore.color(key) }
        : { label: EXPENSE_TYPE_LABEL[key as ExpenseType], color: EXPENSE_TYPE_COLOR[key as ExpenseType] }),
      // Soma em centavos inteiros: evita resíduo de ponto flutuante no tooltip.
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total)
})

const labels = computed(() => slices.value.map((slice) => slice.label))
const series = computed(() => [
  { name: 'Gastos', data: slices.value.map((slice) => slice.total), color: '#6366f1' },
])
const colors = computed(() => slices.value.map((slice) => slice.color))
</script>

<template>
  <BaseCard title="Gastos da fatura" :description="description">
    <template #actions>
      <BaseToggleGroup
        v-model="view"
        :options="VIEW_OPTIONS"
        label="Dados do gráfico de gastos da fatura"
        data-testid="invoice-spending-view"
      />
    </template>

    <BaseSkeleton v-if="loading" height="h-64" />
    <EmptyState
      v-else-if="!slices.length"
      title="Sem gastos na fatura"
      description="Nenhum débito lançado neste cartão no mês selecionado."
    >
      <template #icon>
        <ChartPie class="size-6" aria-hidden="true" />
      </template>
    </EmptyState>
    <template v-else>
      <StatisticsChart type="doughnut" :labels="labels" :series="series" :colors="colors" :height="260" />
      <!-- O canvas não é lido por leitor de tela: a mesma distribuição vai em texto. -->
      <ul class="sr-only">
        <li v-for="slice in slices" :key="slice.label">{{ slice.label }}: {{ formatCurrency(slice.total) }}</li>
      </ul>
    </template>
  </BaseCard>
</template>
