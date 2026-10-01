<script setup lang="ts">
import { CalendarCheck, CircleCheck, Pencil, Plus, Receipt, Repeat, Trash2 } from '@lucide/vue'
import { computed } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import CategoryFilter from '@/components/features/CategoryFilter.vue'
import { useCategoryStore } from '@/stores/categoryStore'
import type { CardTransaction, CreditCardWithInvoice } from '@/types/creditCard'
import { INVOICE_STATUS_LABEL } from '@/types/creditCard'
import type { SelectOption } from '@/types/common'
import type { ExpenseType } from '@/types/expense'
import { EXPENSE_TYPE_LABEL, EXPENSE_TYPE_OPTIONS } from '@/types/expense'
import { formatCurrency } from '@/utils/currencyFormatter'
import { daysUntil, formatDate } from '@/utils/dateFormatter'

const props = defineProps<{
  item: CreditCardWithInvoice | null
  processing?: boolean
  filteredTransactions: CardTransaction[]
  categories: SelectOption<string>[]
  categoryId: string | null
  type: ExpenseType | null
  search: string
  hasActiveFilter: boolean
}>()
const emit = defineEmits<{
  pay: [invoiceId: string]
  newDebit: []
  editDebit: [transaction: CardTransaction]
  removeDebit: [transaction: CardTransaction]
  'update:categoryId': [value: string | null]
  'update:type': [value: ExpenseType | null]
  'update:search': [value: string]
  clear: []
}>()

const categoryStore = useCategoryStore()

const invoice = computed(() => props.item?.invoice ?? null)
const transactions = computed(() => invoice.value?.transactions ?? [])

const canPay = computed(() => Boolean(invoice.value) && invoice.value?.status !== 'PAGA')

const dueNotice = computed(() => {
  if (!invoice.value || invoice.value.status === 'PAGA') return null
  const days = daysUntil(invoice.value.dueDate)
  if (days < 0) return { tone: 'danger' as const, text: `Vencida há ${Math.abs(days)} dia(s)` }
  if (days === 0) return { tone: 'warning' as const, text: 'Vence hoje' }
  if (days <= 5) return { tone: 'warning' as const, text: `Vence em ${days} dia(s)` }
  return { tone: 'info' as const, text: `Vence em ${days} dia(s)` }
})

/** Total por categoria dentro da fatura, para leitura rápida do gasto. */
const categorySummary = computed(() => {
  const grouped = new Map<string, number>()
  for (const transaction of transactions.value) {
    grouped.set(transaction.categoryId, (grouped.get(transaction.categoryId) ?? 0) + transaction.amount)
  }
  return [...grouped.entries()]
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)
})
</script>

<template>
  <BaseCard no-padding>
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-base font-semibold">
          Fatura {{ item ? item.card.name : '' }}
        </h2>
        <BaseBadge v-if="invoice" :tone="invoice.status === 'PAGA' ? 'success' : 'info'">
          {{ INVOICE_STATUS_LABEL[invoice.status] }}
        </BaseBadge>
        <BaseBadge v-if="dueNotice" :tone="dueNotice.tone">
          {{ dueNotice.text }}
        </BaseBadge>
      </div>
      <p v-if="invoice" class="text-muted-foreground mt-0.5 text-sm">
        Fechamento em {{ formatDate(invoice.closingDate) }} · Vencimento em
        {{ formatDate(invoice.dueDate) }}
      </p>
    </template>

    <template #actions>
      <BaseButton v-if="item" variant="outline" size="sm" @click="emit('newDebit')">
        <Plus class="size-4" aria-hidden="true" />
        Novo débito
      </BaseButton>
      <BaseButton
        v-if="invoice && canPay"
        variant="success"
        size="sm"
        :loading="processing"
        @click="emit('pay', invoice.id)"
      >
        <CircleCheck class="size-4" aria-hidden="true" />
        Marcar como paga
      </BaseButton>
      <BaseBadge v-else-if="invoice" tone="success">
        <CalendarCheck class="size-3.5" aria-hidden="true" />
        Paga em {{ formatDate(invoice.paidAt) }}
      </BaseBadge>
    </template>

    <EmptyState
      v-if="!invoice"
      title="Sem fatura neste período"
      description="Nenhum débito lançado neste cartão no mês selecionado."
    >
      <template #icon>
        <Receipt class="size-6" aria-hidden="true" />
      </template>
      <template #action>
        <BaseButton variant="outline" @click="emit('newDebit')">
          <Plus class="size-4" aria-hidden="true" />
          Lançar débito
        </BaseButton>
      </template>
    </EmptyState>

    <template v-else>
      <div class="border-border grid gap-4 border-b p-5 sm:grid-cols-3">
        <div>
          <p class="text-muted-foreground text-xs">Total da fatura</p>
          <p class="tabular-number text-2xl font-semibold">{{ formatCurrency(invoice.total) }}</p>
        </div>
        <div>
          <p class="text-muted-foreground text-xs">Transações</p>
          <p class="tabular-number text-2xl font-semibold">{{ transactions.length }}</p>
        </div>
        <div>
          <p class="text-muted-foreground text-xs">Maiores categorias</p>
          <ul class="mt-1 flex flex-wrap gap-1.5">
            <li v-for="row in categorySummary" :key="row.categoryId">
              <BaseBadge :color="categoryStore.color(row.categoryId)">
                {{ categoryStore.name(row.categoryId) }} · {{ formatCurrency(row.total) }}
              </BaseBadge>
            </li>
          </ul>
        </div>
      </div>

      <div class="border-border border-b p-5">
        <CategoryFilter
          :categories="categories"
          :category-id="categoryId"
          :search="search"
          :extra-options="EXPENSE_TYPE_OPTIONS"
          :extra-value="type"
          extra-label="Tipo"
          :has-active-filter="hasActiveFilter"
          @update:category-id="emit('update:categoryId', $event)"
          @update:search="emit('update:search', $event)"
          @update:extra-value="emit('update:type', $event as ExpenseType | null)"
          @clear="emit('clear')"
        />
      </div>

      <EmptyState
        v-if="!filteredTransactions.length"
        title="Nenhuma transação encontrada"
        description="Ajuste os filtros para encontrar o débito que procura."
      >
        <template #icon>
          <Receipt class="size-6" aria-hidden="true" />
        </template>
      </EmptyState>

      <div v-else class="thin-scroll max-h-[28rem] overflow-auto">
        <table class="w-full text-sm">
          <caption class="sr-only">
            Transações da fatura selecionada
          </caption>
          <thead class="bg-card sticky top-0 z-10">
            <tr class="text-muted-foreground border-border border-b text-left">
              <th scope="col" class="px-5 py-3 font-medium">Descrição</th>
              <th scope="col" class="hidden px-5 py-3 font-medium sm:table-cell">Categoria</th>
              <th scope="col" class="hidden px-5 py-3 font-medium sm:table-cell">Tipo</th>
              <th scope="col" class="px-5 py-3 font-medium">Data</th>
              <th scope="col" class="px-5 py-3 text-right font-medium">Valor</th>
              <th scope="col" class="px-5 py-3 text-right font-medium">
                <span class="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="transaction in filteredTransactions"
              :key="transaction.id"
              class="border-border hover:bg-success/10 border-b transition-colors last:border-0"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ transaction.description }}</span>
                  <Repeat
                    v-if="transaction.recurring"
                    class="text-muted-foreground size-3.5 shrink-0"
                    aria-label="Transação recorrente"
                  />
                  <span
                    v-if="transaction.totalInstallments > 1"
                    class="text-muted-foreground tabular-number text-xs"
                  >
                    {{ transaction.installment }}/{{ transaction.totalInstallments }}
                  </span>
                </div>
              </td>
              <td class="hidden px-5 py-3 sm:table-cell">
                <BaseBadge :color="categoryStore.color(transaction.categoryId)">
                  {{ categoryStore.name(transaction.categoryId) }}
                </BaseBadge>
              </td>
              <td class="text-muted-foreground hidden px-5 py-3 whitespace-nowrap sm:table-cell">
                {{ EXPENSE_TYPE_LABEL[transaction.type] }}
              </td>
              <td class="text-muted-foreground tabular-number px-5 py-3 whitespace-nowrap">
                {{ formatDate(transaction.date) }}
              </td>
              <td class="tabular-number px-5 py-3 text-right font-semibold">
                {{ formatCurrency(transaction.amount) }}
              </td>
              <td class="px-5 py-3">
                <div class="flex justify-end gap-1">
                  <BaseButton
                    variant="ghost"
                    size="icon"
                    :aria-label="`Editar ${transaction.description}`"
                    @click="emit('editDebit', transaction)"
                  >
                    <Pencil class="size-4" aria-hidden="true" />
                  </BaseButton>
                  <BaseButton
                    variant="ghost"
                    size="icon"
                    class="hover:text-danger"
                    :aria-label="`Excluir ${transaction.description}`"
                    @click="emit('removeDebit', transaction)"
                  >
                    <Trash2 class="size-4" aria-hidden="true" />
                  </BaseButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseCard>
</template>
