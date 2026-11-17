<script setup lang="ts">
import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import type { HomeBill } from '@/types/home'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate } from '@/utils/dateFormatter'

/** Contas pendentes que vencem na semana (segunda a domingo), cada uma com link para a saída. */
defineProps<{ bills: HomeBill[]; total: number; count: number }>()
</script>

<template>
  <BaseCard title="Contas da semana" data-testid="home-bills">
    <template #actions>
      <span v-if="count" class="text-sm font-semibold tabular-nums" data-testid="bills-total">{{ formatCurrency(total) }}</span>
    </template>

    <p v-if="!count" class="text-muted-foreground text-sm" data-testid="bills-empty">Nenhuma conta vence nesta semana.</p>

    <ul v-else class="divide-border flex flex-col divide-y">
      <li v-for="bill in bills" :key="bill.id" class="py-1 first:pt-0 last:pb-0" data-testid="bill-item">
        <!-- Fatura de cartão é uma saída derivada: o destino dela é a aba Cartões. -->
        <RouterLink
          :to="{ name: bill.automatic ? 'cards' : 'expenses' }"
          class="hover:bg-muted focus-visible:outline-ring flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 text-sm focus-visible:outline-2"
          :aria-label="`${bill.description}, ${formatCurrency(bill.amount)}, vence em ${formatDate(bill.dueDate)}${bill.overdue ? ', vencida' : ''}`"
        >
          <span class="min-w-0 flex-1 font-medium wrap-break-word">{{ bill.description }}</span>
          <BaseBadge v-if="bill.overdue" tone="danger" data-testid="bill-overdue">Vencida</BaseBadge>
          <span class="text-muted-foreground tabular-nums text-xs">{{ formatDate(bill.dueDate).slice(0, 5) }}</span>
          <span class="tabular-nums font-medium">{{ formatCurrency(bill.amount) }}</span>
        </RouterLink>
      </li>
    </ul>
  </BaseCard>
</template>
