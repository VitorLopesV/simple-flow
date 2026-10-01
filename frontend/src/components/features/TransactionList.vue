<script setup lang="ts">
import { Pencil, Repeat, Trash2 } from '@lucide/vue'
import { computed } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BasePagination from '@/components/common/BasePagination.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useCategoryStore } from '@/stores/categoryStore'
import { useCreditCardStore } from '@/stores/creditCardStore'
import type { Movement } from '@/types/category'
import type { Expense } from '@/types/expense'
import { EXPENSE_STATUS_LABEL, EXPENSE_TYPE_LABEL, PAYMENT_METHOD_LABEL } from '@/types/expense'
import type { Income } from '@/types/income'
import { INCOME_TYPE_LABEL } from '@/types/income'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate } from '@/utils/dateFormatter'

type Transaction = Income | Expense

const props = withDefaults(
  defineProps<{
    kind: Movement
    items: Transaction[]
    loading?: boolean
    page: number
    totalPages: number
    total: number
    pageSize: number
    emptyTitle?: string
    emptyDescription?: string
  }>(),
  {
    loading: false,
    emptyTitle: 'Nenhum lançamento encontrado',
    emptyDescription: 'Ajuste os filtros ou adicione um novo lançamento neste período.',
  },
)

const emit = defineEmits<{
  edit: [transaction: Transaction]
  remove: [transaction: Transaction]
  toggleStatus: [transaction: Expense]
  changePage: [page: number]
}>()

const categoryStore = useCategoryStore()
const creditCardStore = useCreditCardStore()

const isExpense = computed(() => props.kind === 'SAIDA')
const amountColor = computed(() => (isExpense.value ? 'text-danger' : 'text-success'))
const sign = computed(() => (isExpense.value ? '−' : '+'))

function asExpense(transaction: Transaction): Expense {
  return transaction as Expense
}

/** Rótulo do tipo (detalhe dentro da categoria), conforme o movimento da lista. */
function typeLabel(transaction: Transaction): string {
  return isExpense.value
    ? EXPENSE_TYPE_LABEL[asExpense(transaction).type]
    : (INCOME_TYPE_LABEL[(transaction as Income).type] ?? '—')
}

/** Ocorrência projetada de uma recorrência, ainda sem lançamento próprio no mês. */
function isRecurringProjection(transaction: Transaction): boolean {
  return Boolean(transaction.recurrenceOriginId)
}

/** Realça a linha da fatura com a cor definida ao cartão na aba Cartões. */
function rowStyle(transaction: Transaction) {
  if (!isExpense.value) return undefined
  const expense = asExpense(transaction)
  const color = expense.automatic && expense.cardId ? creditCardStore.byId(expense.cardId)?.color : null
  return color ? { backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` } : undefined
}

function isAutomatic(transaction: Transaction): boolean {
  return isExpense.value && Boolean(asExpense(transaction).automatic)
}

// Editar (ou alternar a situação de) uma ocorrência projetada materializa um
// lançamento próprio daquele mês — independente do original em situação, data de
// pagamento e valor. Só a fatura de cartão continua totalmente bloqueada aqui.
function canEdit(transaction: Transaction): boolean {
  return !isAutomatic(transaction)
}

// Remover só faz sentido depois que a ocorrência já existe como lançamento próprio.
function canDelete(transaction: Transaction): boolean {
  return !isAutomatic(transaction) && !isRecurringProjection(transaction)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="loading" class="flex flex-col gap-3 p-5">
      <BaseSkeleton v-for="line in 5" :key="line" height="h-10" />
    </div>

    <EmptyState v-else-if="!items.length" :title="emptyTitle" :description="emptyDescription">
      <template #action>
        <slot name="emptyAction" />
      </template>
    </EmptyState>

    <template v-else>
      <!-- Tabela (telas médias em diante) -->
      <div class="hidden md:block">
        <table class="w-full table-fixed text-xs wrap-anywhere lg:text-sm">
          <caption class="sr-only">
            Lista de {{ isExpense ? 'saídas' : 'entradas' }} do período selecionado
          </caption>
          <colgroup>
            <template v-if="isExpense">
              <col class="w-[17%]" />
              <col class="w-[14%]" />
              <col class="w-[6%]" />
              <col class="w-[9%]" />
              <col class="w-[9%]" />
              <col class="w-[9%]" />
              <col class="w-[8%]" />
              <col class="w-[9%]" />
              <col class="w-[10%]" />
              <col class="w-[9%]" />
            </template>
            <template v-else>
              <col class="w-[26%]" />
              <col class="w-[18%]" />
              <col class="w-[13%]" />
              <col class="w-[16%]" />
              <col class="w-[17%]" />
              <col class="w-[10%]" />
            </template>
          </colgroup>
          <thead>
            <tr class="text-muted-foreground border-border border-b text-left">
              <th scope="col" class="px-2 py-3 lg:px-3 xl:px-5 font-medium">Descrição</th>
              <th scope="col" class="px-2 py-3 lg:px-3 xl:px-5 font-medium">Categoria</th>
              <th scope="col" class="px-2 py-3 lg:px-3 xl:px-5 font-medium">Tipo</th>
              <th scope="col" class="px-2 py-3 lg:px-3 xl:px-5 font-medium">Data</th>
              <th v-if="isExpense" scope="col" class="px-2 py-3 lg:px-3 xl:px-5 font-medium">Vencimento</th>
              <th v-if="isExpense" scope="col" class="px-2 py-3 lg:px-3 xl:px-5 font-medium">Pagamento</th>
              <th v-if="isExpense" scope="col" class="px-2 py-3 lg:px-3 xl:px-5 font-medium">Situação</th>
              <th v-if="isExpense" scope="col" class="px-2 py-3 lg:px-3 xl:px-5 font-medium">Pago em</th>
              <th scope="col" class="px-2 py-3 lg:px-3 xl:px-5 text-right font-medium">Valor</th>
              <th scope="col" class="px-2 py-3 lg:px-3 xl:px-5 text-right font-medium">
                <span class="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="transaction in items"
              :key="transaction.id"
              :style="rowStyle(transaction)"
              class="border-border hover:bg-success/10 border-b transition-colors last:border-0"
            >
              <td class="px-2 py-3 lg:px-3 xl:px-5">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ transaction.description }}</span>
                  <Repeat
                    v-if="transaction.recurring"
                    class="text-muted-foreground size-3.5 shrink-0"
                    aria-label="Lançamento recorrente"
                  />
                </div>
                <p v-if="transaction.notes" class="text-muted-foreground truncate text-xs">
                  {{ transaction.notes }}
                </p>
              </td>

              <td class="px-2 py-3 lg:px-3 xl:px-5 [&>span]:whitespace-normal">
                <BaseBadge :color="categoryStore.color(transaction.categoryId)">
                  {{ categoryStore.name(transaction.categoryId) }}
                </BaseBadge>
              </td>

              <td class="text-muted-foreground px-2 py-3 lg:px-3 xl:px-5">
                {{ typeLabel(transaction) }}
              </td>

              <td class="text-muted-foreground tabular-number px-2 py-3 lg:px-3 xl:px-5">
                {{ formatDate(transaction.date) }}
              </td>

              <td v-if="isExpense" class="text-muted-foreground tabular-number px-2 py-3 lg:px-3 xl:px-5">
                {{ asExpense(transaction).dueDate ? formatDate(asExpense(transaction).dueDate!) : '—' }}
              </td>

              <td v-if="isExpense" class="text-muted-foreground px-2 py-3 lg:px-3 xl:px-5">
                {{ PAYMENT_METHOD_LABEL[asExpense(transaction).paymentMethod] }}
              </td>

              <td v-if="isExpense" class="px-2 py-3 lg:px-3 xl:px-5">
                <button
                  v-if="canEdit(transaction)"
                  type="button"
                  class="focus-visible:outline-ring rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
                  :title="
                    asExpense(transaction).status === 'PAGO'
                      ? 'Marcar como pendente'
                      : 'Marcar como pago'
                  "
                  @click="emit('toggleStatus', asExpense(transaction))"
                >
                  <BaseBadge :tone="asExpense(transaction).status === 'PAGO' ? 'success' : 'warning'">
                    {{ EXPENSE_STATUS_LABEL[asExpense(transaction).status] }}
                  </BaseBadge>
                </button>
                <BaseBadge v-else :tone="asExpense(transaction).status === 'PAGO' ? 'success' : 'warning'">
                  {{ EXPENSE_STATUS_LABEL[asExpense(transaction).status] }}
                </BaseBadge>
              </td>

              <td v-if="isExpense" class="text-muted-foreground tabular-number px-2 py-3 lg:px-3 xl:px-5">
                {{ asExpense(transaction).paidAt ? formatDate(asExpense(transaction).paidAt!) : '—' }}
              </td>

              <td class="tabular-number px-2 py-3 lg:px-3 xl:px-5 text-right font-semibold" :class="amountColor">
                {{ sign }} {{ formatCurrency(transaction.amount) }}
              </td>

              <td class="px-2 py-3 lg:px-3 xl:px-5">
                <div v-if="canEdit(transaction)" class="flex flex-wrap justify-end gap-1">
                  <BaseButton
                    variant="ghost"
                    size="icon"
                    :aria-label="`Editar ${transaction.description}`"
                    @click="emit('edit', transaction)"
                  >
                    <Pencil class="size-4" aria-hidden="true" />
                  </BaseButton>
                  <BaseButton
                    v-if="canDelete(transaction)"
                    variant="ghost"
                    size="icon"
                    class="hover:text-danger"
                    :aria-label="`Excluir ${transaction.description}`"
                    @click="emit('remove', transaction)"
                  >
                    <Trash2 class="size-4" aria-hidden="true" />
                  </BaseButton>
                </div>
                <span v-else class="text-muted-foreground text-xs">Ver em Cartões</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Cartões (mobile) -->
      <ul class="divide-border divide-y md:hidden">
        <li
          v-for="transaction in items"
          :key="transaction.id"
          :style="rowStyle(transaction)"
          class="flex flex-col gap-2 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-medium">{{ transaction.description }}</p>
              <p class="text-muted-foreground text-xs">{{ formatDate(transaction.date) }}</p>
            </div>
            <p class="tabular-number shrink-0 font-semibold" :class="amountColor">
              {{ sign }} {{ formatCurrency(transaction.amount) }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <BaseBadge :color="categoryStore.color(transaction.categoryId)">
              {{ categoryStore.name(transaction.categoryId) }}
            </BaseBadge>
            <BaseBadge>
              {{ typeLabel(transaction) }}
            </BaseBadge>
            <BaseBadge
              v-if="isExpense"
              :tone="asExpense(transaction).status === 'PAGO' ? 'success' : 'warning'"
            >
              {{ EXPENSE_STATUS_LABEL[asExpense(transaction).status] }}
            </BaseBadge>

            <div v-if="canEdit(transaction)" class="ml-auto flex gap-1">
              <BaseButton
                variant="ghost"
                size="icon"
                :aria-label="`Editar ${transaction.description}`"
                @click="emit('edit', transaction)"
              >
                <Pencil class="size-4" aria-hidden="true" />
              </BaseButton>
              <BaseButton
                v-if="canDelete(transaction)"
                variant="ghost"
                size="icon"
                class="hover:text-danger"
                :aria-label="`Excluir ${transaction.description}`"
                @click="emit('remove', transaction)"
              >
                <Trash2 class="size-4" aria-hidden="true" />
              </BaseButton>
            </div>
            <span v-else class="text-muted-foreground ml-auto text-xs">Ver em Cartões</span>
          </div>

          <div v-if="isExpense" class="text-muted-foreground flex flex-wrap gap-x-4 text-xs">
            <span v-if="asExpense(transaction).dueDate">
              Vencimento: {{ formatDate(asExpense(transaction).dueDate!) }}
            </span>
            <span v-if="asExpense(transaction).paidAt">
              Pago em: {{ formatDate(asExpense(transaction).paidAt!) }}
            </span>
          </div>
        </li>
      </ul>

      <div class="px-5 pb-5">
        <BasePagination
          :page="page"
          :total-pages="totalPages"
          :total="total"
          :page-size="pageSize"
          @change="emit('changePage', $event)"
        />
      </div>
    </template>
  </div>
</template>
