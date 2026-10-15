<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import type { SelectOption } from '@/types/common'

const props = withDefaults(
  defineProps<{
    categories: SelectOption<string>[]
    categoryId: string | null
    search: string
    /** Filtro extra opcional (ex.: status de pagamento nas saídas). */
    extraOptions?: SelectOption<string>[] | null
    extraValue?: string | null
    extraLabel?: string
    hasActiveFilter?: boolean
  }>(),
  { extraOptions: null, extraValue: null, extraLabel: 'Status', hasActiveFilter: false },
)

const emit = defineEmits<{
  'update:categoryId': [value: string | null]
  'update:search': [value: string]
  'update:extraValue': [value: string | null]
  clear: []
}>()

const selectedCategory = computed({
  get: () => props.categoryId,
  set: (value) => emit('update:categoryId', value),
})

const selectedExtra = computed({
  get: () => props.extraValue,
  set: (value) => emit('update:extraValue', value),
})

// Busca com debounce para não disparar uma requisição por tecla digitada.
const searchText = ref(props.search)
let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.search,
  (value) => {
    if (value !== searchText.value) searchText.value = value
  },
)

watch(searchText, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => emit('update:search', String(value ?? '')), 350)
})
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
    <div class="sm:max-w-xs sm:flex-1">
      <BaseInput
        v-model="searchText"
        label="Buscar"
        placeholder="Descrição ou observação"
        inputmode="search"
        type="search"
      >
        <template #prefix>
          <Search class="size-4" aria-hidden="true" />
        </template>
      </BaseInput>
    </div>

    <div class="sm:w-56">
      <BaseSelect
        v-model="selectedCategory"
        label="Categoria"
        placeholder="Todas as categorias"
        allow-empty
        :options="categories"
      />
    </div>

    <div v-if="extraOptions" class="sm:w-44">
      <BaseSelect
        v-model="selectedExtra"
        :label="extraLabel"
        placeholder="Todos"
        allow-empty
        :options="extraOptions"
      />
    </div>

    <BaseButton v-if="hasActiveFilter" variant="ghost" class="sm:mb-0.5" @click="emit('clear')">
      <X class="size-4" aria-hidden="true" />
      Limpar filtros
    </BaseButton>
  </div>
</template>
