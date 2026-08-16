<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/cn'

type Tom = 'neutro' | 'sucesso' | 'perigo' | 'aviso' | 'info'

const props = withDefaults(
  defineProps<{
    tom?: Tom
    /** Cor livre (hex) — usada para o ponto colorido das categorias. */
    cor?: string | null
  }>(),
  { tom: 'neutro', cor: null },
)

const TONS: Record<Tom, string> = {
  neutro: 'bg-muted text-muted-foreground',
  sucesso: 'bg-success-soft text-success',
  perigo: 'bg-danger-soft text-danger',
  aviso: 'bg-warning-soft text-warning',
  info: 'bg-primary/10 text-primary',
}

const classes = computed(() =>
  cn(
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
    TONS[props.tom],
  ),
)
</script>

<template>
  <span :class="classes">
    <span
      v-if="cor"
      class="size-2 shrink-0 rounded-full"
      :style="{ backgroundColor: cor }"
      aria-hidden="true"
    />
    <slot />
  </span>
</template>
