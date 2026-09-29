<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/cn'

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'info'

const props = withDefaults(
  defineProps<{
    tone?: Tone
    /** Cor livre (hex) — usada para o ponto colorido das categorias. */
    color?: string | null
  }>(),
  { tone: 'neutral', color: null },
)

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-primary/10 text-primary',
}

const classes = computed(() =>
  cn(
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
    TONES[props.tone],
  ),
)
</script>

<template>
  <span :class="classes">
    <span
      v-if="color"
      class="size-2 shrink-0 rounded-full"
      :style="{ backgroundColor: color }"
      aria-hidden="true"
    />
    <slot />
  </span>
</template>
