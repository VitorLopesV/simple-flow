import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { creditCardService } from '@/services/creditCardService'
import { EditedMonthsError, getErrorMessage } from '@/services/http'
import { matchesSearch } from '@/services/mock'
import type {
  CardTransaction,
  CardTransactionPayload,
  CreditCard,
  CreditCardPayload,
  CreditCardWithInvoice,
} from '@/types/creditCard'
import type { SeriesChangeOptions } from '@/types/common'
import type { ExpenseType } from '@/types/expense'
import { addMonths, dayInPeriod, fromReferenceMonth, toDate } from '@/utils/dateFormatter'
import { usePeriodStore } from './periodStore'

/** Divide um valor em `n` parcelas (centavos inteiros), sobrando o resto para as primeiras. */
function splitIntoInstallments(amount: number, n: number): number[] {
  const totalCents = Math.round(amount * 100)
  const base = Math.floor(totalCents / n)
  const remainder = totalCents - base * n
  return Array.from({ length: n }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100)
}

export const useCreditCardStore = defineStore('creditCard', () => {
  const periodStore = usePeriodStore()

  const cards = ref<CreditCardWithInvoice[]>([])
  const selectedCardId = ref<string | null>(null)

  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  /**
   * Meses seguintes alterados (`YYYY-MM`) que barraram a última exclusão/desativação de
   * uma série. A página mostra a confirmação e repete a operação com `{ confirm: true }`.
   */
  const editedMonths = ref<string[] | null>(null)

  const categoryId = ref<string | null>(null)
  const type = ref<ExpenseType | null>(null)
  const search = ref('')

  const selected = computed<CreditCardWithInvoice | null>(() => {
    if (!cards.value.length) return null
    return (
      cards.value.find((item) => item.card.id === selectedCardId.value) ??
      cards.value[0] ??
      null
    )
  })

  const totalInvoices = computed(() =>
    cards.value.reduce((sum, item) => sum + (item.invoice?.total ?? 0), 0),
  )

  const totalLimit = computed(() =>
    cards.value.filter((item) => item.card.active).reduce((sum, item) => sum + item.card.limit, 0),
  )

  const openInvoices = computed(
    () => cards.value.filter((item) => item.invoice && item.invoice.status !== 'PAGA').length,
  )

  const isEmpty = computed(() => !loading.value && cards.value.length === 0)

  const hasActiveFilter = computed(
    () => Boolean(categoryId.value) || Boolean(type.value) || search.value.trim() !== '',
  )

  /**
   * Transações da fatura selecionada após aplicar busca/categoria/tipo. Filtragem
   * client-side: diferente de saídas/entradas, a fatura já vem inteira do backend
   * para o período (sem paginação), então não há necessidade de recarregar.
   */
  const filteredTransactions = computed<CardTransaction[]>(() => {
    const transactions = selected.value?.invoice?.transactions ?? []
    return transactions.filter(
      (transaction) =>
        matchesSearch(`${transaction.description} ${transaction.notes ?? ''}`, search.value) &&
        (!categoryId.value || transaction.categoryId === categoryId.value) &&
        (!type.value || transaction.type === type.value),
    )
  })

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      cards.value = await creditCardService.listWithInvoices({ period: periodStore.period })

      const stillExists = cards.value.some((item) => item.card.id === selectedCardId.value)
      if (!stillExists) selectedCardId.value = cards.value[0]?.card.id ?? null
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível carregar os cartões.')
      cards.value = []
    } finally {
      loading.value = false
    }
  }

  function select(id: string): void {
    selectedCardId.value = id
  }

  function filterByCategory(id: string | null): void {
    categoryId.value = id
  }

  function filterByType(newType: ExpenseType | null): void {
    type.value = newType
  }

  function setSearch(text: string): void {
    search.value = text
  }

  function clearFilters(): void {
    categoryId.value = null
    type.value = null
    search.value = ''
  }

  async function create(payload: CreditCardPayload): Promise<boolean> {
    saving.value = true
    try {
      const card = await creditCardService.create(payload)
      await load()
      selectedCardId.value = card.id
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível salvar o cartão.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function update(id: string, payload: CreditCardPayload): Promise<boolean> {
    saving.value = true
    try {
      await creditCardService.update(id, payload)
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível atualizar o cartão.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function remove(id: string): Promise<boolean> {
    saving.value = true
    try {
      await creditCardService.remove(id)
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível excluir o cartão.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function createTransaction(cardId: string, payload: CardTransactionPayload): Promise<boolean> {
    saving.value = true
    try {
      const totalInstallments = payload.totalInstallments

      if (totalInstallments <= 1) {
        await creditCardService.createTransaction(cardId, payload)
      } else {
        // Compra parcelada: uma transação por competência futura, valor dividido
        // (resto fica com as primeiras parcelas), mesmo dia do mês da compra.
        const amounts = splitIntoInstallments(payload.amount, totalInstallments)
        const day = toDate(payload.date).getDate()
        const baseMonth = fromReferenceMonth(payload.date.slice(0, 7))

        // Cada parcela cai numa competência distinta (fatura própria), então as
        // requisições são independentes e disparadas em paralelo, não em série.
        await Promise.all(
          amounts.map((amount, i) =>
            creditCardService.createTransaction(cardId, {
              ...payload,
              amount,
              date: dayInPeriod(addMonths(baseMonth, i), day),
              installment: i + 1,
              totalInstallments,
            }),
          ),
        )
      }

      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível salvar o débito.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function updateTransaction(
    cardId: string,
    id: string,
    payload: CardTransactionPayload,
    options: SeriesChangeOptions = {},
  ): Promise<boolean> {
    saving.value = true
    editedMonths.value = null
    try {
      await creditCardService.updateTransaction(cardId, id, payload, options)
      await load()
      return true
    } catch (e) {
      if (e instanceof EditedMonthsError) {
        editedMonths.value = e.months
        return false
      }
      error.value = getErrorMessage(e, 'Não foi possível atualizar o débito.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function removeTransaction(
    cardId: string,
    id: string,
    options: SeriesChangeOptions = {},
  ): Promise<boolean> {
    saving.value = true
    editedMonths.value = null
    try {
      await creditCardService.removeTransaction(cardId, id, options)
      await load()
      return true
    } catch (e) {
      if (e instanceof EditedMonthsError) {
        editedMonths.value = e.months
        return false
      }
      error.value = getErrorMessage(e, 'Não foi possível excluir o débito.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function payInvoice(invoiceId: string): Promise<boolean> {
    saving.value = true
    try {
      await creditCardService.payInvoice(invoiceId)
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível registrar o pagamento.')
      return false
    } finally {
      saving.value = false
    }
  }

  /** Lista simples (sem fatura), útil para selects de forma de pagamento. */
  const cardOptions = computed(() =>
    cards.value
      .filter((item) => item.card.active)
      .map((item) => ({
        label: `${item.card.name} ····${item.card.lastDigits}`,
        value: item.card.id,
      })),
  )

  function byId(id: string | null | undefined): CreditCard | null {
    if (!id) return null
    return cards.value.find((item) => item.card.id === id)?.card ?? null
  }

  return {
    cards,
    selectedCardId,
    loading,
    saving,
    error,
    editedMonths,
    categoryId,
    type,
    search,
    selected,
    totalInvoices,
    totalLimit,
    openInvoices,
    isEmpty,
    hasActiveFilter,
    filteredTransactions,
    cardOptions,
    load,
    select,
    create,
    update,
    remove,
    createTransaction,
    updateTransaction,
    removeTransaction,
    payInvoice,
    byId,
    filterByCategory,
    filterByType,
    setSearch,
    clearFilters,
  }
})
