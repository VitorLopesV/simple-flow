import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/services/http'
import { incomeService } from '@/services/incomeService'
import type { Income, IncomePayload, IncomeSummary, IncomeType } from '@/types/income'
import { calculateChange } from '@/utils/currencyFormatter'
import { usePeriodStore } from './periodStore'

const DEFAULT_PAGE_SIZE = 20

export const useIncomeStore = defineStore('income', () => {
  const periodStore = usePeriodStore()

  const items = ref<Income[]>([])
  const summary = ref<IncomeSummary | null>(null)

  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const page = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const total = ref(0)
  const totalPages = ref(1)

  const categoryId = ref<string | null>(null)
  const type = ref<IncomeType | null>(null)
  const search = ref('')

  const periodTotal = computed(() => summary.value?.total ?? 0)
  const change = computed(() =>
    summary.value ? calculateChange(summary.value.total, summary.value.previousMonthTotal) : 0,
  )
  const hasActiveFilter = computed(
    () => Boolean(categoryId.value) || Boolean(type.value) || search.value.trim() !== '',
  )
  const isEmpty = computed(() => !loading.value && items.value.length === 0)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const filter = {
        period: periodStore.period,
        categoryId: categoryId.value,
        type: type.value,
        search: search.value,
        page: page.value,
        pageSize: pageSize.value,
      }

      const [result, newSummary] = await Promise.all([
        incomeService.list(filter),
        incomeService.summary(periodStore.period),
      ])

      items.value = result.items
      page.value = result.page
      total.value = result.total
      totalPages.value = result.totalPages
      summary.value = newSummary
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível carregar as entradas.')
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function create(payload: IncomePayload): Promise<boolean> {
    saving.value = true
    try {
      await incomeService.create(payload)
      page.value = 1
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível salvar a entrada.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function update(id: string, payload: IncomePayload): Promise<boolean> {
    saving.value = true
    try {
      await incomeService.update(id, payload)
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível atualizar a entrada.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function remove(id: string): Promise<boolean> {
    saving.value = true
    try {
      await incomeService.remove(id)
      // Se a página ficou vazia após a remoção, volta uma página.
      if (items.value.length === 1 && page.value > 1) page.value -= 1
      await load()
      return true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível excluir a entrada.')
      return false
    } finally {
      saving.value = false
    }
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

  function filterByType(newType: IncomeType | null): void {
    type.value = newType
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
    type.value = null
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
    page,
    pageSize,
    total,
    totalPages,
    categoryId,
    type,
    search,
    periodTotal,
    change,
    hasActiveFilter,
    isEmpty,
    load,
    create,
    update,
    remove,
    goToPage,
    filterByCategory,
    filterByType,
    setSearch,
    clearFilters,
  }
})
