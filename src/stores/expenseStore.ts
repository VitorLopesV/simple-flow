import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { compareExpensesByDueDate, expenseService } from '@/services/expenseService'
import { EditedMonthsError, getErrorMessage } from '@/services/http'
import type { SeriesChangeOptions } from '@/types/common'
import type { Expense, ExpensePayload, ExpenseStatus, ExpenseSummary } from '@/types/expense'
import { calculateChange } from '@/utils/currencyFormatter'
import { usePeriodStore } from './periodStore'

const DEFAULT_PAGE_SIZE = 20

export const useExpenseStore = defineStore('expense', () => {
  const periodStore = usePeriodStore()

  const items = ref<Expense[]>([])
  const summary = ref<ExpenseSummary | null>(null)

  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  /**
   * Meses seguintes alterados (`YYYY-MM`) que barraram a última exclusão/desativação de
   * uma série. A página mostra a confirmação e repete a operação com `{ confirm: true }`.
   */
  const editedMonths = ref<string[] | null>(null)

  const page = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const total = ref(0)
  const totalPages = ref(1)

  const categoryId = ref<string | null>(null)
  const status = ref<ExpenseStatus | null>(null)
  const search = ref('')

  const periodTotal = computed(() => summary.value?.total ?? 0)
  const change = computed(() =>
    summary.value ? calculateChange(summary.value.total, summary.value.previousMonthTotal) : 0,
  )
  const hasActiveFilter = computed(
    () => Boolean(categoryId.value) || Boolean(status.value) || search.value.trim() !== '',
  )
  const isEmpty = computed(() => !loading.value && items.value.length === 0)
  /**
   * Reordena a página atual: vencimento primeiro (mais próximo primeiro) e,
   * para quem não tem vencimento, pela data de lançamento mais recente
   * primeiro. Aplicado aqui (e não no template) para valer tanto pro mock
   * quanto pra API real, sem depender da ordem em que os dados chegaram.
   */
  const sortedItems = computed(() => [...items.value].sort(compareExpensesByDueDate))

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const filter = {
        period: periodStore.period,
        categoryId: categoryId.value,
        status: status.value,
        search: search.value,
        page: page.value,
        pageSize: pageSize.value,
      }

      const [result, newSummary] = await Promise.all([
        expenseService.list(filter),
        expenseService.summary(periodStore.period),
      ])

      items.value = result.items
      page.value = result.page
      total.value = result.total
      totalPages.value = result.totalPages
      summary.value = newSummary
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível carregar as saídas.')
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function create(payload: ExpensePayload): Promise<boolean> {
    saving.value = true
    try {
      await expenseService.create(payload)
      page.value = 1
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível salvar a saída.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function update(
    id: string,
    payload: ExpensePayload,
    options: SeriesChangeOptions = {},
  ): Promise<boolean> {
    saving.value = true
    editedMonths.value = null
    try {
      await expenseService.update(id, payload, options)
      await load()
      return true
    } catch (e) {
      if (e instanceof EditedMonthsError) {
        editedMonths.value = e.months
        return false
      }
      error.value = getErrorMessage(e, 'Não foi possível atualizar a saída.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function remove(id: string, options: SeriesChangeOptions = {}): Promise<boolean> {
    saving.value = true
    editedMonths.value = null
    try {
      await expenseService.remove(id, options)
      if (items.value.length === 1 && page.value > 1) page.value -= 1
      await load()
      return true
    } catch (e) {
      if (e instanceof EditedMonthsError) {
        editedMonths.value = e.months
        return false
      }
      error.value = getErrorMessage(e, 'Não foi possível excluir a saída.')
      return false
    } finally {
      saving.value = false
    }
  }

  /** Alterna entre pago e pendente sem abrir o formulário. */
  async function toggleStatus(expense: Expense): Promise<boolean> {
    const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = expense
    return update(id, { ...rest, status: expense.status === 'PAGO' ? 'PENDENTE' : 'PAGO' })
  }

  function goToPage(newPage: number): void {
    page.value = Math.min(Math.max(1, newPage), totalPages.value)
    void load()
  }

  function filterByCategory(id: string | null): void {
    categoryId.value = id
    page.value = 1
    void load()
  }

  function filterByStatus(newStatus: ExpenseStatus | null): void {
    status.value = newStatus
    page.value = 1
    void load()
  }

  function setSearch(text: string): void {
    search.value = text
    page.value = 1
    void load()
  }

  function clearFilters(): void {
    categoryId.value = null
    status.value = null
    search.value = ''
    page.value = 1
    void load()
  }

  return {
    items,
    summary,
    loading,
    saving,
    error,
    editedMonths,
    page,
    pageSize,
    total,
    totalPages,
    categoryId,
    status,
    search,
    periodTotal,
    change,
    hasActiveFilter,
    isEmpty,
    sortedItems,
    load,
    create,
    update,
    remove,
    toggleStatus,
    goToPage,
    filterByCategory,
    filterByStatus,
    setSearch,
    clearFilters,
  }
})
