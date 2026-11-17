<script setup lang="ts">
import { computed } from 'vue'

import BaseCard from '@/components/common/BaseCard.vue'
import type { HomeFinances } from '@/types/home'
import { formatCurrency, formatPercent } from '@/utils/currencyFormatter'
import { fromReferenceMonth, formatPeriod } from '@/utils/dateFormatter'

/** Saldo e fluxo do mês (competência atual), com link para as Finanças (Dashboard). */
const props = defineProps<{ finances: HomeFinances }>()

const monthLabel = computed(() => formatPeriod(fromReferenceMonth(props.finances.referenceMonth)))
const positive = computed(() => props.finances.balance >= 0)

/** Variação sobre o mês anterior, como o Dashboard: `+12,3%` / `-4,0%`. */
function change(fraction: number): string {
  return `${fraction > 0 ? '+' : ''}${formatPercent(fraction)}`
}
</script>

<template>
  <BaseCard :title="`Finanças · ${monthLabel}`" data-testid="home-finances">
    <template #actions>
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="text-primary focus-visible:outline-ring rounded text-sm font-medium hover:underline focus-visible:outline-2"
        data-testid="finances-link"
      >
        Ver finanças
      </RouterLink>
    </template>

    <div class="flex flex-col gap-4">
      <p class="text-2xl font-semibold tabular-nums" :class="positive ? 'text-success' : 'text-danger'" data-testid="finances-balance">
        <span class="text-muted-foreground block text-sm font-normal">Saldo do mês</span>
        {{ formatCurrency(finances.balance) }}
      </p>
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt class="text-muted-foreground">Entradas</dt>
          <dd class="font-medium tabular-nums" data-testid="finances-income">{{ formatCurrency(finances.totalIncome) }}</dd>
          <dd class="text-muted-foreground text-xs tabular-nums">{{ change(finances.incomeChange) }} vs. mês anterior</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Saídas</dt>
          <dd class="font-medium tabular-nums" data-testid="finances-expenses">{{ formatCurrency(finances.totalExpenses) }}</dd>
          <dd class="text-muted-foreground text-xs tabular-nums">{{ change(finances.expenseChange) }} vs. mês anterior</dd>
        </div>
      </dl>
    </div>
  </BaseCard>
</template>
