<script setup lang="ts">
import { ArrowUpCircle, Hash, Plus, Sigma } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import CategoryFilter from '@/components/features/CategoryFilter.vue'
import MonthPicker from '@/components/features/MonthPicker.vue'
import SummaryCard from '@/components/features/SummaryCard.vue'
import TransactionForm from '@/components/features/TransactionForm.vue'
import TransactionList from '@/components/features/TransactionList.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notify } from '@/composables/useNotify'
import { useCategoryStore } from '@/stores/categoryStore'
import { useIncomeStore } from '@/stores/incomeStore'
import { usePeriodStore } from '@/stores/periodStore'
import type { CardTransactionPayload } from '@/types/creditCard'
import type { ExpensePayload } from '@/types/expense'
import type { Income, IncomePayload, IncomeType } from '@/types/income'
import { INCOME_TYPE_OPTIONS } from '@/types/income'
import { formatPeriod } from '@/utils/dateFormatter'

const periodStore = usePeriodStore()
const categoryStore = useCategoryStore()
const incomeStore = useIncomeStore()

const modalOpen = ref(false)
const confirmationOpen = ref(false)
const editing = ref<Income | null>(null)
const toDelete = ref<Income | null>(null)

const categoryOptions = computed(() => categoryStore.options('ENTRADA'))
const modalTitle = computed(() => (editing.value ? 'Editar entrada' : 'Nova entrada'))

onMounted(() => void incomeStore.load())
watch(() => periodStore.period, () => void incomeStore.load(), { deep: true })
watch(
  () => incomeStore.error,
  (error) => error && notify.error(error),
)

function openNew(): void {
  editing.value = null
  modalOpen.value = true
}

function openEdit(income: Income): void {
  editing.value = income
  modalOpen.value = true
}

async function save(
  payload: IncomePayload | ExpensePayload | CardTransactionPayload,
): Promise<void> {
  const income = payload as IncomePayload
  const current = editing.value

  const success = current
    ? await incomeStore.update(current.id, income)
    : await incomeStore.create(income)

  if (!success) return

  notify.success(current ? 'Entrada atualizada' : 'Entrada adicionada', income.description)
  // Um lançamento pode antecipar o primeiro mês com dados (limite do seletor de mês).
  void periodStore.loadLimits()
  modalOpen.value = false
  editing.value = null
}

function askDelete(income: Income): void {
  toDelete.value = income
  confirmationOpen.value = true
}

async function confirmDelete(): Promise<void> {
  const income = toDelete.value
  if (!income) return

  if (await incomeStore.remove(income.id)) {
    notify.success('Entrada excluída', income.description)
  }
  confirmationOpen.value = false
  toDelete.value = null
}
</script>

<template>
  <PageLayout title="Entradas" :description="`Receitas de ${formatPeriod(periodStore.period)}`">
    <template #actions>
      <MonthPicker
        v-model="periodStore.period"
        :min="periodStore.minPeriod"
        :max="periodStore.maxPeriod"
        @today="periodStore.goToToday()"
      />
      <BaseButton variant="success" class="!h-11" @click="openNew">
        <Plus class="size-4" aria-hidden="true" />
        Nova entrada
      </BaseButton>
    </template>

    <div class="grid gap-4 sm:grid-cols-3">
      <SummaryCard
        label="Total de entradas"
        :value="incomeStore.periodTotal"
        :icon="ArrowUpCircle"
        tone="success"
        :change="incomeStore.change"
        :loading="incomeStore.loading && !incomeStore.summary"
      />
      <SummaryCard
        label="Ticket médio"
        :value="incomeStore.summary?.average ?? 0"
        :icon="Sigma"
        tone="info"
        detail="por lançamento"
        :loading="incomeStore.loading && !incomeStore.summary"
      />
      <div class="bg-card border-border rounded-card border p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <p class="text-muted-foreground text-sm font-medium">Lançamentos</p>
          <span class="bg-muted text-muted-foreground rounded-lg p-2">
            <Hash class="size-4" aria-hidden="true" />
          </span>
        </div>
        <p class="tabular-number mt-3 text-2xl font-semibold">
          {{ incomeStore.summary?.count ?? 0 }}
        </p>
        <p class="text-muted-foreground mt-2 text-xs">no período selecionado</p>
      </div>
    </div>

    <BaseCard no-padding>
      <template #header>
        <h2 class="text-base font-semibold">Lançamentos</h2>
        <p class="text-muted-foreground mt-0.5 text-sm">
          {{ incomeStore.total }} registro(s) encontrados
        </p>
      </template>

      <div class="border-border border-b p-5">
        <CategoryFilter
          :categories="categoryOptions"
          :category-id="incomeStore.categoryId"
          :search="incomeStore.search"
          :extra-options="INCOME_TYPE_OPTIONS"
          :extra-value="incomeStore.type"
          extra-label="Tipo"
          :has-active-filter="incomeStore.hasActiveFilter"
          @update:category-id="incomeStore.filterByCategory($event)"
          @update:search="incomeStore.setSearch($event)"
          @update:extra-value="incomeStore.filterByType($event as IncomeType | null)"
          @clear="incomeStore.clearFilters()"
        />
      </div>

      <TransactionList
        kind="ENTRADA"
        :items="incomeStore.items"
        :loading="incomeStore.loading"
        :page="incomeStore.page"
        :total-pages="incomeStore.totalPages"
        :total="incomeStore.total"
        :page-size="incomeStore.pageSize"
        empty-title="Nenhuma entrada encontrada"
        empty-description="Registre suas receitas para acompanhar o total do mês."
        @edit="openEdit($event as Income)"
        @remove="askDelete($event as Income)"
        @change-page="incomeStore.goToPage($event)"
      >
        <template #emptyAction>
          <BaseButton variant="outline" @click="openNew">
            <Plus class="size-4" aria-hidden="true" />
            Adicionar entrada
          </BaseButton>
        </template>
      </TransactionList>
    </BaseCard>

    <BaseModal v-model:open="modalOpen" :title="modalTitle">
      <TransactionForm
        kind="ENTRADA"
        :transaction="editing"
        :categories="categoryOptions"
        :saving="incomeStore.saving"
        @save="save"
        @cancel="modalOpen = false"
      />
    </BaseModal>

    <ConfirmDialog
      v-model:open="confirmationOpen"
      title="Excluir entrada"
      :message="`Tem certeza que deseja excluir “${toDelete?.description ?? ''}”? Esta ação não pode ser desfeita.`"
      confirm-text="Excluir"
      :loading="incomeStore.saving"
      @confirm="confirmDelete"
    />
  </PageLayout>
</template>
