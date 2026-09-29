<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import BaseButton from './BaseButton.vue'

const props = defineProps<{
  page: number
  totalPages: number
  total: number
  pageSize: number
}>()

const emit = defineEmits<{ change: [page: number] }>()

const firstItem = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const lastItem = computed(() => Math.min(props.page * props.pageSize, props.total))

/** Janela de páginas com reticências: 1 … 4 5 6 … 12 */
const pages = computed<(number | '…')[]>(() => {
  const total = props.totalPages
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const current = props.page
  const visible = new Set<number>([1, total, current, current - 1, current + 1])
  const sorted = [...visible].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)

  const result: (number | '…')[] = []
  let previous = 0
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push('…')
    result.push(page)
    previous = page
  }
  return result
})
</script>

<template>
  <nav
    v-if="total > 0"
    class="flex flex-col items-center justify-between gap-3 sm:flex-row"
    aria-label="Paginação"
  >
    <p class="text-muted-foreground text-xs">
      Mostrando <span class="text-foreground font-medium">{{ firstItem }}–{{ lastItem }}</span>
      de <span class="text-foreground font-medium">{{ total }}</span> registros
    </p>

    <div class="flex items-center gap-1">
      <BaseButton
        variant="outline"
        size="icon"
        aria-label="Página anterior"
        :disabled="page <= 1"
        @click="emit('change', page - 1)"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
      </BaseButton>

      <template v-for="(item, index) in pages" :key="`${item}-${index}`">
        <span v-if="item === '…'" class="text-muted-foreground px-1.5 text-sm">…</span>
        <BaseButton
          v-else
          :variant="item === page ? 'primary' : 'ghost'"
          size="icon"
          :aria-label="`Ir para a página ${item}`"
          :aria-current="item === page ? 'page' : undefined"
          @click="emit('change', item)"
        >
          {{ item }}
        </BaseButton>
      </template>

      <BaseButton
        variant="outline"
        size="icon"
        aria-label="Próxima página"
        :disabled="page >= totalPages"
        @click="emit('change', page + 1)"
      >
        <ChevronRight class="size-4" aria-hidden="true" />
      </BaseButton>
    </div>
  </nav>
</template>
