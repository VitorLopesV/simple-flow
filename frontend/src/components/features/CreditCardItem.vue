<script setup lang="ts">
import { CreditCard, Pencil, Trash2 } from '@lucide/vue'
import { computed } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import type { CreditCardWithInvoice } from '@/types/creditCard'
import { CARD_BRAND_LABEL, INVOICE_STATUS_LABEL } from '@/types/creditCard'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate } from '@/utils/dateFormatter'

const props = defineProps<{ item: CreditCardWithInvoice; selected: boolean }>()

const emit = defineEmits<{
  select: [id: string]
  edit: [item: CreditCardWithInvoice]
  remove: [item: CreditCardWithInvoice]
}>()

const card = computed(() => props.item.card)
const invoice = computed(() => props.item.invoice)

const usage = computed(() => Math.min(100, Math.round(props.item.limitUsage)))
const available = computed(() => Math.max(0, card.value.limit - (invoice.value?.total ?? 0)))

const statusTone = computed(() => {
  switch (invoice.value?.status) {
    case 'PAGA':
      return 'success' as const
    case 'ATRASADA':
      return 'danger' as const
    case 'FECHADA':
      return 'warning' as const
    default:
      return 'info' as const
  }
})

const barColor = computed(() => (usage.value >= 80 ? 'bg-danger' : usage.value >= 50 ? 'bg-warning' : 'bg-success'))
</script>

<template>
  <article
    class="bg-card border-border rounded-card border p-4 shadow-sm transition-shadow"
    :class="selected ? 'ring-primary/60 ring-2' : 'hover:shadow-md'"
  >
    <button
      type="button"
      class="focus-visible:outline-ring w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4"
      :aria-pressed="selected"
      @click="emit('select', card.id)"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
            :style="{ backgroundColor: card.color }"
          >
            <CreditCard class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <p class="truncate font-semibold">{{ card.name }}</p>
            <p class="text-muted-foreground tabular-number text-xs">
              {{ CARD_BRAND_LABEL[card.brand] }} ····{{ card.lastDigits }}
            </p>
          </div>
        </div>

        <BaseBadge v-if="!card.active" tone="neutral">Inativo</BaseBadge>
        <BaseBadge v-else-if="invoice" :tone="statusTone">
          {{ INVOICE_STATUS_LABEL[invoice.status] }}
        </BaseBadge>
      </div>

      <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt class="text-muted-foreground text-xs">Fatura atual</dt>
          <dd class="tabular-number font-semibold">{{ formatCurrency(invoice?.total ?? 0) }}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground text-xs">Limite disponível</dt>
          <dd class="tabular-number font-semibold">{{ formatCurrency(available) }}</dd>
        </div>
      </dl>

      <div class="mt-3">
        <div class="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            class="h-full rounded-full transition-all"
            :class="barColor"
            :style="{ width: `${usage}%` }"
          />
        </div>
        <p class="text-muted-foreground mt-1.5 text-xs">
          {{ usage }}% do limite de {{ formatCurrency(card.limit) }}
          <span v-if="invoice"> · vence em {{ formatDate(invoice.dueDate) }}</span>
        </p>
      </div>
    </button>

    <div class="border-border mt-3 flex justify-end gap-1 border-t pt-3">
      <BaseButton
        variant="ghost"
        size="icon"
        :aria-label="`Editar ${card.name}`"
        @click="emit('edit', item)"
      >
        <Pencil class="size-4" aria-hidden="true" />
      </BaseButton>
      <BaseButton
        variant="ghost"
        size="icon"
        class="hover:text-danger"
        :aria-label="`Excluir ${card.name}`"
        @click="emit('remove', item)"
      >
        <Trash2 class="size-4" aria-hidden="true" />
      </BaseButton>
    </div>
  </article>
</template>
