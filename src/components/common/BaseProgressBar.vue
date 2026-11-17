<script setup lang="ts">
import { computed } from 'vue'

/**
 * Barra de progresso acessível (`role="progressbar"`). A largura anima só sem
 * `prefers-reduced-motion` (`motion-reduce:transition-none`, além da regra global).
 */
const props = withDefaults(
  defineProps<{
    /** 0 a 100. */
    value: number
    label: string
    tone?: 'primary' | 'success'
  }>(),
  { tone: 'primary' },
)

const clamped = computed(() => Math.min(100, Math.max(0, Math.floor(props.value))))
</script>

<template>
  <div
    class="bg-muted h-2 w-full overflow-hidden rounded-full"
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="clamped"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuetext="`${clamped}%`"
  >
    <div
      class="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
      :class="tone === 'success' ? 'bg-success' : 'bg-primary'"
      :style="{ width: `${clamped}%` }"
    />
  </div>
</template>
