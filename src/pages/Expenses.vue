<script setup lang="ts">
import { ArrowDownCircle, CircleCheck, Clock, Plus } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import CategoryFilter from '@/components/features/CategoryFilter.vue'
import EditedMonthsDialog from '@/components/features/EditedMonthsDialog.vue'
import MonthPicker from '@/components/features/MonthPicker.vue'
import SummaryCard from '@/components/features/SummaryCard.vue'
import TransactionForm from '@/components/features/TransactionForm.vue'
import TransactionList from '@/components/features/TransactionList.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { useEditedMonthsConfirmation } from '@/composables/useEditedMonthsConfirmation'
import { notify } from '@/composables/useNotify'
import { useCategoryStore } from '@/stores/categoryStore'
import { useCreditCardStore } from '@/stores/creditCardStore'
import { useExpenseStore } from '@/stores/expenseStore'
import { usePeriodStore } from '@/stores/periodStore'
import type { CardTransactionPayload } from '@/types/creditCard'
import type { Expense, ExpensePayload, ExpenseStatus } from '@/types/expense'
import { EXPENSE_STATUS_OPTIONS, isExpenseOverdue } from '@/types/expense'
import type { IncomePayload } from '@/types/income'
import { formatPeriod } from '@/utils/dateFormatter'

const periodStore = usePeriodStore()
const categoryStore = useCategoryStore()
const expenseStore = useExpenseStore()
const creditCardStore = useCreditCardStore()

const modalOpen = ref(false)
const confirmationOpen = ref(false)
const editing = ref<Expense | null>(null)
const toDelete = ref<Expense | null>(null)
const pendingOpen = ref(false)
const toPending = ref<Expense | null>(null)
const paymentOpen = ref(false)
const toPaid = ref<Expense | null>(null)

const seriesChange = useEditedMonthsConfirmation()

const categoryOptions = computed(() => categoryStore.options('SAIDA'))
const statusOptions = computed(() =>
  EXPENSE_STATUS_OPTIONS.map((option) => ({ label: option.label, value: option.value as string })),
)
const modalTitle = computed(() => (editing.value ? 'Editar saída' : 'Nova saída'))

onMounted(() => {
  void expenseStore.load()
  // As cores dos cartões realçam as linhas de fatura na tabela.
  if (!creditCardStore.cards.length) void creditCardStore.load()
})

watch(() => periodStore.period, () => void expenseStore.load(), { deep: true })
watch(
  () => expenseStore.error,
  (error) => error && notify.error(error),
)

function openNew(): void {
  editing.value = null
  modalOpen.value = true
}

function openEdit(expense: Expense): void {
  editing.value = expense
  modalOpen.value = true
}

async function save(
  payload: IncomePayload | ExpensePayload | CardTransactionPayload,
): Promise<void> {
  const expense = payload as ExpensePayload
  const current = editing.value

  const success = current
    ? await expenseStore.update(current.id, expense)
    : await expenseStore.create(expense)

  if (success) return afterSave(Boolean(current), expense)

  // Desligar a recorrência barrado por meses seguintes alterados: pede confirmação.
  if (current && expenseStore.editedMonths) {
    seriesChange.ask({
      action: 'deactivate',
      description: current.description,
      months: expenseStore.editedMonths,
      run: async () => {
        if (await expenseStore.update(current.id, expense, { confirm: true })) afterSave(true, expense)
      },
    })
  }
}

function afterSave(updated: boolean, expense: ExpensePayload): void {
  notify.success(updated ? 'Saída atualizada' : 'Saída adicionada', expense.description)
  modalOpen.value = false
  editing.value = null
  // Um lançamento pode antecipar o primeiro mês com dados (limite do seletor de mês).
  void periodStore.loadLimits()
}

/** Na série recorrente, excluir leva junto os meses seguintes — o texto deixa isso claro. */
const deleteMessage = computed(() => {
  const expense = toDelete.value
  const name = `“${expense?.description ?? ''}”`
  return expense?.recurring
    ? `Excluir ${name} remove este mês e os seguintes da série. Os meses anteriores não são afetados.`
    : `Tem certeza que deseja excluir ${name}? Esta ação não pode ser desfeita.`
})

function askDelete(expense: Expense): void {
  toDelete.value = expense
  confirmationOpen.value = true
}

async function confirmDelete(): Promise<void> {
  const expense = toDelete.value
  if (!expense) return

  if (await expenseStore.remove(expense.id)) {
    notify.success('Saída excluída', expense.description)
  } else if (expenseStore.editedMonths) {
    seriesChange.ask({
      action: 'remove',
      description: expense.description,
      months: expenseStore.editedMonths,
      run: async () => {
        if (await expenseStore.remove(expense.id, { confirm: true })) {
          notify.success('Saída excluída', expense.description)
        }
      },
    })
  }
  confirmationOpen.value = false
  toDelete.value = null
}

/** Ambas as transições exigem confirmação. */
function askToggleStatus(expense: Expense): void {
  if (expense.status === 'PAGO') {
    toPending.value = expense
    pendingOpen.value = true
    return
  }
  toPaid.value = expense
  paymentOpen.value = true
}

async function confirmPending(): Promise<void> {
  const expense = toPending.value
  if (!expense) return
  await toggleStatus(expense)
  pendingOpen.value = false
  toPending.value = null
}

/** A saída vencida continua pendente por baixo; o texto só acompanha o que o badge mostrava. */
const paymentMessage = computed(() => {
  const expense = toPaid.value
  const from = expense && isExpenseOverdue(expense) ? 'vencido' : 'pendente'
  return `Deseja realmente alterar “${expense?.description ?? ''}” de ${from} para pago?`
})

async function confirmPaid(): Promise<void> {
  const expense = toPaid.value
  if (!expense) return
  await toggleStatus(expense)
  paymentOpen.value = false
  toPaid.value = null
}

async function toggleStatus(expense: Expense): Promise<void> {
  if (await expenseStore.toggleStatus(expense)) {
    notify.success(
      expense.status === 'PAGO' ? 'Marcada como pendente' : 'Marcada como paga',
      expense.description,
    )
  }
}

</script>

<template>
  <PageLayout title="Saídas" :description="`Despesas de ${formatPeriod(periodStore.period)}`">
    <template #actions>
      <MonthPicker
        v-model="periodStore.period"
        :min="periodStore.minPeriod"
        :max="periodStore.maxPeriod"
        @today="periodStore.goToToday()"
      />
      <BaseButton variant="success" class="!h-11" @click="openNew">
        <Plus class="size-4" aria-hidden="true" />
        Nova saída
      </BaseButton>
    </template>

    <div class="grid gap-4 sm:grid-cols-3">
      <SummaryCard
        label="Total de saídas"
        :value="expenseStore.periodTotal"
        :icon="ArrowDownCircle"
        tone="danger"
        :change="expenseStore.change"
        inverted-change
        :loading="expenseStore.loading && !expenseStore.summary"
      />
      <SummaryCard
        label="Já pago"
        :value="expenseStore.summary?.paidTotal ?? 0"
        :icon="CircleCheck"
        tone="success"
        :change="null"
        detail="liquidado no período"
        :loading="expenseStore.loading && !expenseStore.summary"
      />
      <SummaryCard
        label="Em aberto"
        :value="expenseStore.summary?.pendingTotal ?? 0"
        :icon="Clock"
        tone="warning"
        :change="null"
        detail="aguardando pagamento"
        :loading="expenseStore.loading && !expenseStore.summary"
      />
    </div>

    <BaseCard no-padding>
      <template #header>
        <h2 class="text-base font-semibold">Lançamentos</h2>
        <p class="text-muted-foreground mt-0.5 text-sm">
          {{ expenseStore.total }} registro(s) encontrados
        </p>
      </template>

      <div class="border-border border-b p-5">
        <CategoryFilter
          :categories="categoryOptions"
          :category-id="expenseStore.categoryId"
          :search="expenseStore.search"
          :extra-options="statusOptions"
          :extra-value="expenseStore.status"
          extra-label="Situação"
          :has-active-filter="expenseStore.hasActiveFilter"
          @update:category-id="expenseStore.filterByCategory($event)"
          @update:search="expenseStore.setSearch($event)"
          @update:extra-value="expenseStore.filterByStatus($event as ExpenseStatus | null)"
          @clear="expenseStore.clearFilters()"
        />
      </div>

      <TransactionList
        kind="SAIDA"
        :items="expenseStore.sortedItems"
        :loading="expenseStore.loading"
        :page="expenseStore.page"
        :total-pages="expenseStore.totalPages"
        :total="expenseStore.total"
        :page-size="expenseStore.pageSize"
        empty-title="Nenhuma saída encontrada"
        empty-description="Cadastre suas despesas para acompanhar o quanto já foi gasto no mês."
        @edit="openEdit($event as Expense)"
        @remove="askDelete($event as Expense)"
        @toggle-status="askToggleStatus"
        @change-page="expenseStore.goToPage($event)"
      >
        <template #emptyAction>
          <BaseButton variant="outline" @click="openNew">
            <Plus class="size-4" aria-hidden="true" />
            Adicionar saída
          </BaseButton>
        </template>
      </TransactionList>
    </BaseCard>

    <BaseModal v-model:open="modalOpen" :title="modalTitle">
      <TransactionForm
        kind="SAIDA"
        :transaction="editing"
        :categories="categoryOptions"
        :saving="expenseStore.saving"
        @save="save"
        @cancel="modalOpen = false"
      />
    </BaseModal>

    <ConfirmDialog
      v-model:open="confirmationOpen"
      title="Excluir saída"
      :message="deleteMessage"
      confirm-text="Excluir"
      :loading="expenseStore.saving"
      @confirm="confirmDelete"
    />

    <EditedMonthsDialog
      v-model:open="seriesChange.open.value"
      :action="seriesChange.pending.value?.action ?? 'remove'"
      :months="seriesChange.pending.value?.months ?? []"
      :description="seriesChange.pending.value?.description"
      :loading="expenseStore.saving"
      @confirm="seriesChange.confirm"
      @cancel="seriesChange.cancel"
    />

    <ConfirmDialog
      v-model:open="pendingOpen"
      title="Alterar para pendente"
      :message="`Deseja realmente alterar “${toPending?.description ?? ''}” de pago para pendente?`"
      confirm-text="Alterar para pendente"
      :destructive="false"
      :loading="expenseStore.saving"
      @confirm="confirmPending"
    />

    <ConfirmDialog
      v-model:open="paymentOpen"
      title="Alterar para pago"
      :message="paymentMessage"
      confirm-text="Alterar para pago"
      :destructive="false"
      :loading="expenseStore.saving"
      @confirm="confirmPaid"
    />
  </PageLayout>
</template>
