<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import BaseButton from './BaseButton.vue'

const props = defineProps<{
  pagina: number
  totalPaginas: number
  total: number
  tamanhoPagina: number
}>()

const emit = defineEmits<{ mudar: [pagina: number] }>()

const primeiroItem = computed(() => (props.total === 0 ? 0 : (props.pagina - 1) * props.tamanhoPagina + 1))
const ultimoItem = computed(() => Math.min(props.pagina * props.tamanhoPagina, props.total))

/** Janela de páginas com reticências: 1 … 4 5 6 … 12 */
const paginas = computed<(number | '…')[]>(() => {
  const total = props.totalPaginas
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const atual = props.pagina
  const janela = new Set<number>([1, total, atual, atual - 1, atual + 1])
  const ordenadas = [...janela].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)

  const resultado: (number | '…')[] = []
  let anterior = 0
  for (const pagina of ordenadas) {
    if (anterior && pagina - anterior > 1) resultado.push('…')
    resultado.push(pagina)
    anterior = pagina
  }
  return resultado
})
</script>

<template>
  <nav
    v-if="total > 0"
    class="flex flex-col items-center justify-between gap-3 sm:flex-row"
    aria-label="Paginação"
  >
    <p class="text-muted-foreground text-xs">
      Mostrando <span class="text-foreground font-medium">{{ primeiroItem }}–{{ ultimoItem }}</span>
      de <span class="text-foreground font-medium">{{ total }}</span> registros
    </p>

    <div class="flex items-center gap-1">
      <BaseButton
        variante="outline"
        tamanho="icon"
        aria-label="Página anterior"
        :desabilitado="pagina <= 1"
        @click="emit('mudar', pagina - 1)"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
      </BaseButton>

      <template v-for="(item, indice) in paginas" :key="`${item}-${indice}`">
        <span v-if="item === '…'" class="text-muted-foreground px-1.5 text-sm">…</span>
        <BaseButton
          v-else
          :variante="item === pagina ? 'primary' : 'ghost'"
          tamanho="icon"
          :aria-label="`Ir para a página ${item}`"
          :aria-current="item === pagina ? 'page' : undefined"
          @click="emit('mudar', item)"
        >
          {{ item }}
        </BaseButton>
      </template>

      <BaseButton
        variante="outline"
        tamanho="icon"
        aria-label="Próxima página"
        :desabilitado="pagina >= totalPaginas"
        @click="emit('mudar', pagina + 1)"
      >
        <ChevronRight class="size-4" aria-hidden="true" />
      </BaseButton>
    </div>
  </nav>
</template>
