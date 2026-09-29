import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { categoryService } from '@/services/categoryService'
import { getErrorMessage } from '@/services/http'
import type { SelectOption } from '@/types/common'
import type { Category, CategoryType, Movement } from '@/types/category'
import { CATEGORY_TYPE_LABEL } from '@/types/category'

export const useCategoryStore = defineStore('category', () => {
  const categories = ref<Category[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  const byId = computed(() => {
    const map = new Map<string, Category>()
    for (const category of categories.value) map.set(category.id, category)
    return map
  })

  const incomeCategories = computed(() => categories.value.filter((c) => c.movement === 'ENTRADA'))
  const expenseCategories = computed(() => categories.value.filter((c) => c.movement === 'SAIDA'))

  /** Opções agrupadas por tipo, no formato consumido pelo BaseSelect. */
  function options(movement: Movement): SelectOption[] {
    const list = movement === 'ENTRADA' ? incomeCategories.value : expenseCategories.value
    return list.map((category) => ({
      // Em saídas o nome já É o agrupamento (Despesa Fixa/Variável/Investimento); em
      // entradas "Renda" é o tipo padrão — nos dois casos o sufixo não agrega nada.
      label:
        movement === 'SAIDA' || category.type === 'RENDA'
          ? category.name
          : `${category.name} · ${CATEGORY_TYPE_LABEL[category.type]}`,
      value: category.id,
    }))
  }

  function name(id: string | null | undefined): string {
    if (!id) return 'Sem categoria'
    return byId.value.get(id)?.name ?? 'Sem categoria'
  }

  function color(id: string | null | undefined): string {
    if (!id) return '#94a3b8'
    return byId.value.get(id)?.color ?? '#94a3b8'
  }

  function type(id: string | null | undefined): CategoryType | null {
    if (!id) return null
    return byId.value.get(id)?.type ?? null
  }

  /** Carrega uma única vez por sessão, a menos que `force` seja verdadeiro. */
  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return

    loading.value = true
    error.value = null
    try {
      categories.value = await categoryService.list()
      loaded.value = true
    } catch (e) {
      error.value = getErrorMessage(e, 'Não foi possível carregar as categorias.')
    } finally {
      loading.value = false
    }
  }

  return {
    categories,
    loading,
    error,
    loaded,
    byId,
    incomeCategories,
    expenseCategories,
    options,
    name,
    color,
    type,
    load,
  }
})
