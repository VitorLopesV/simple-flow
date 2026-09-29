<script setup lang="ts">
import { CreditCard, Plus, Receipt, Wallet } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import CreditCardForm from '@/components/features/CreditCardForm.vue'
import CreditCardItem from '@/components/features/CreditCardItem.vue'
import InvoiceDetails from '@/components/features/InvoiceDetails.vue'
import MonthPicker from '@/components/features/MonthPicker.vue'
import SummaryCard from '@/components/features/SummaryCard.vue'
import TransactionForm from '@/components/features/TransactionForm.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notify } from '@/composables/useNotify'
import { useCategoryStore } from '@/stores/categoryStore'
import { useCreditCardStore } from '@/stores/creditCardStore'
import { usePeriodStore } from '@/stores/periodStore'
import type {
  CardTransaction,
  CardTransactionPayload,
  CreditCard as Card,
  CreditCardPayload,
  CreditCardWithInvoice,
} from '@/types/creditCard'
import type { ExpensePayload, ExpenseType } from '@/types/expense'
import type { IncomePayload } from '@/types/income'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatPeriod } from '@/utils/dateFormatter'

const periodStore = usePeriodStore()
const categoryStore = useCategoryStore()
const creditCardStore = useCreditCardStore()

const modalOpen = ref(false)
const confirmationOpen = ref(false)
const editing = ref<Card | null>(null)
const toDelete = ref<Card | null>(null)

const debitModalOpen = ref(false)
const debitConfirmationOpen = ref(false)
const debitEditing = ref<CardTransaction | null>(null)
const debitToDelete = ref<CardTransaction | null>(null)

const paymentConfirmationOpen = ref(false)
const invoiceIdToPay = ref<string | null>(null)

const categoryOptions = computed(() => categoryStore.options('SAIDA'))
const modalTitle = computed(() => (editing.value ? 'Editar cartão' : 'Novo cartão'))
const debitModalTitle = computed(() => (debitEditing.value ? 'Editar débito' : 'Novo débito'))

onMounted(() => void creditCardStore.load())
watch(() => periodStore.period, () => void creditCardStore.load(), { deep: true })
watch(
  () => creditCardStore.error,
  (error) => error && notify.error(error),
)

function openNew(): void {
  editing.value = null
  modalOpen.value = true
}

function openEdit(item: CreditCardWithInvoice): void {
  editing.value = item.card
  modalOpen.value = true
}

async function save(payload: CreditCardPayload): Promise<void> {
  const current = editing.value

  const success = current
    ? await creditCardStore.update(current.id, payload)
    : await creditCardStore.create(payload)

  if (!success) return

  notify.success(current ? 'Cartão atualizado' : 'Cartão adicionado', payload.name)
  modalOpen.value = false
  editing.value = null
}

function askDelete(item: CreditCardWithInvoice): void {
  toDelete.value = item.card
  confirmationOpen.value = true
}

async function confirmDelete(): Promise<void> {
  const card = toDelete.value
  if (!card) return

  if (await creditCardStore.remove(card.id)) {
    notify.success('Cartão excluído', card.name)
  }
  confirmationOpen.value = false
  toDelete.value = null
}

function askPaymentConfirmation(invoiceId: string): void {
  invoiceIdToPay.value = invoiceId
  paymentConfirmationOpen.value = true
}

async function confirmInvoicePayment(): Promise<void> {
  const invoiceId = invoiceIdToPay.value
  if (!invoiceId) return

  if (await creditCardStore.payInvoice(invoiceId)) notify.success('Fatura marcada como paga')
  paymentConfirmationOpen.value = false
  invoiceIdToPay.value = null
}

function openNewDebit(): void {
  debitEditing.value = null
  debitModalOpen.value = true
}

function openEditDebit(transaction: CardTransaction): void {
  debitEditing.value = transaction
  debitModalOpen.value = true
}

async function saveDebit(payload: IncomePayload | ExpensePayload | CardTransactionPayload): Promise<void> {
  const cardId = creditCardStore.selected?.card.id
  if (!cardId) return

  const debit = payload as CardTransactionPayload
  const current = debitEditing.value

  const success = current
    ? await creditCardStore.updateTransaction(cardId, current.id, debit)
    : await creditCardStore.createTransaction(cardId, debit)

  if (!success) return

  notify.success(current ? 'Débito atualizado' : 'Débito lançado', debit.description)
  debitModalOpen.value = false
  debitEditing.value = null
}

function askDeleteDebit(transaction: CardTransaction): void {
  debitToDelete.value = transaction
  debitConfirmationOpen.value = true
}

async function confirmDeleteDebit(): Promise<void> {
  const debit = debitToDelete.value
  if (!debit) return

  if (await creditCardStore.removeTransaction(debit.cardId, debit.id)) {
    notify.success('Débito excluído', debit.description)
  }
  debitConfirmationOpen.value = false
  debitToDelete.value = null
}
</script>

<template>
  <PageLayout
    title="Cartões de Crédito"
    :description="`Faturas e transações de ${formatPeriod(periodStore.period)}`"
  >
    <template #actions>
      <MonthPicker
        v-model="periodStore.period"
        @today="periodStore.goToToday()"
      />
      <BaseButton variant="success" class="!h-11" @click="openNew">
        <Plus class="size-4" aria-hidden="true" />
        Novo cartão
      </BaseButton>
    </template>

    <div class="grid gap-4 sm:grid-cols-3">
      <SummaryCard
        label="Total das faturas"
        :value="creditCardStore.totalInvoices"
        :icon="Receipt"
        tone="danger"
        :change="null"
        detail="no período selecionado"
        :loading="creditCardStore.loading && !creditCardStore.cards.length"
      />
      <SummaryCard
        label="Limite total"
        :value="creditCardStore.totalLimit"
        :icon="Wallet"
        tone="info"
        :change="null"
        detail="somando os cartões ativos"
        :loading="creditCardStore.loading && !creditCardStore.cards.length"
      />
      <div class="bg-card border-border rounded-card border p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <p class="text-muted-foreground text-sm font-medium">Faturas em aberto</p>
          <span class="bg-warning-soft text-warning rounded-lg p-2">
            <CreditCard class="size-4" aria-hidden="true" />
          </span>
        </div>
        <p class="tabular-number mt-3 text-2xl font-semibold">{{ creditCardStore.openInvoices }}</p>
        <p class="text-muted-foreground mt-2 text-xs">
          de {{ creditCardStore.cards.length }} cartão(ões) cadastrado(s)
        </p>
      </div>
    </div>

    <div class="grid gap-6 2xl:grid-cols-[22rem_minmax(0,1fr)]">
      <section class="flex flex-col gap-4" aria-label="Cartões cadastrados">
        <template v-if="creditCardStore.loading && !creditCardStore.cards.length">
          <div v-for="i in 2" :key="i" class="bg-card border-border rounded-card border p-4">
            <BaseSkeleton :lines="3" height="h-6" />
          </div>
        </template>

        <BaseCard v-else-if="creditCardStore.isEmpty" no-padding>
          <EmptyState
            title="Nenhum cartão cadastrado"
            description="Cadastre um cartão para acompanhar faturas e transações."
          >
            <template #icon>
              <CreditCard class="size-6" aria-hidden="true" />
            </template>
            <template #action>
              <BaseButton variant="outline" @click="openNew">
                <Plus class="size-4" aria-hidden="true" />
                Adicionar cartão
              </BaseButton>
            </template>
          </EmptyState>
        </BaseCard>

        <template v-else>
          <CreditCardItem
            v-for="item in creditCardStore.cards"
            :key="item.card.id"
            :item="item"
            :selected="item.card.id === creditCardStore.selected?.card.id"
            @select="creditCardStore.select($event)"
            @edit="openEdit"
            @remove="askDelete"
          />
        </template>
      </section>

      <InvoiceDetails
        v-if="creditCardStore.selected"
        :item="creditCardStore.selected"
        :processing="creditCardStore.saving"
        :filtered-transactions="creditCardStore.filteredTransactions"
        :categories="categoryOptions"
        :category-id="creditCardStore.categoryId"
        :type="creditCardStore.type"
        :search="creditCardStore.search"
        :has-active-filter="creditCardStore.hasActiveFilter"
        @pay="askPaymentConfirmation"
        @new-debit="openNewDebit"
        @edit-debit="openEditDebit"
        @remove-debit="askDeleteDebit"
        @update:category-id="creditCardStore.filterByCategory($event)"
        @update:type="creditCardStore.filterByType($event as ExpenseType | null)"
        @update:search="creditCardStore.setSearch($event)"
        @clear="creditCardStore.clearFilters()"
      />
    </div>

    <BaseModal v-model:open="modalOpen" :title="modalTitle">
      <CreditCardForm
        :card="editing"
        :saving="creditCardStore.saving"
        @save="save"
        @cancel="modalOpen = false"
      />
    </BaseModal>

    <BaseModal v-model:open="debitModalOpen" :title="debitModalTitle">
      <TransactionForm
        kind="SAIDA"
        context="card"
        :transaction="debitEditing"
        :categories="categoryOptions"
        :saving="creditCardStore.saving"
        @save="saveDebit"
        @cancel="debitModalOpen = false"
      />
    </BaseModal>

    <ConfirmDialog
      v-model:open="debitConfirmationOpen"
      title="Excluir débito"
      :message="`Excluir “${debitToDelete?.description ?? ''}” também remove o valor da fatura. Deseja continuar?`"
      confirm-text="Excluir"
      :loading="creditCardStore.saving"
      @confirm="confirmDeleteDebit"
    />

    <ConfirmDialog
      v-model:open="confirmationOpen"
      title="Excluir cartão"
      :message="`Excluir “${toDelete?.name ?? ''}” também remove as faturas e transações vinculadas. Deseja continuar?`"
      confirm-text="Excluir"
      :loading="creditCardStore.saving"
      @confirm="confirmDelete"
    />

    <ConfirmDialog
      v-model:open="paymentConfirmationOpen"
      title="Confirmar pagamento"
      :message="`Confirmar pagamento da fatura de “${creditCardStore.selected?.card.name ?? ''}” no valor de ${formatCurrency(creditCardStore.selected?.invoice?.total ?? 0)}?`"
      confirm-text="Confirmar"
      :destructive="false"
      :loading="creditCardStore.saving"
      @confirm="confirmInvoicePayment"
    />
  </PageLayout>
</template>
