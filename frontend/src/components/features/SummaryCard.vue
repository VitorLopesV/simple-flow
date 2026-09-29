<script setup lang="ts">
import { TrendingDown, TrendingUp } from '@lucide/vue'
import type { Component } from 'vue'
import { computed } from 'vue'

import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import { formatCurrency, formatPercent } from '@/utils/currencyFormatter'

type Tone = 'neutral' | 'success' | 'danger' | 'info' | 'warning'

const props = withDefaults(
  defineProps<{
    label: string
    value: number
    icon?: Component | null
    tone?: Tone
    /** Variação em fração (0.12 = +12%) em relação ao mês anterior. */
    change?: number | null
    /** Quando a métrica é uma despesa, subir é ruim: inverte as cores. */
    invertedChange?: boolean
    detail?: string
    loading?: boolean
  }>(),
  {
    icon: null,
    tone: 'neutral',
    change: null,
    invertedChange: false,
    detail: '',
    loading: false,
  },
)

const TONES: Record<Tone, { icon: string; value: string }> = {
  neutral: { icon: 'bg-muted text-muted-foreground', value: 'text-foreground' },
  success: { icon: 'bg-success-soft text-success', value: 'text-success' },
  danger: { icon: 'bg-danger-soft text-danger', value: 'text-danger' },
  info: { icon: 'bg-primary/10 text-primary', value: 'text-foreground' },
  warning: { icon: 'bg-warning-soft text-warning', value: 'text-foreground' },
}

const wentUp = computed(() => (props.change ?? 0) >= 0)

const changeColor = computed(() => {
  const positive = props.invertedChange ? !wentUp.value : wentUp.value
  return positive ? 'text-success' : 'text-danger'
})
</script>

<template>
  <div class="bg-card border-border rounded-card border p-5 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <p class="text-muted-foreground text-sm font-medium">{{ label }}</p>
      <span v-if="icon" class="rounded-lg p-2" :class="TONES[tone].icon">
        <component :is="icon" class="size-4" aria-hidden="true" />
      </span>
    </div>

    <BaseSkeleton v-if="loading" height="h-8" class="mt-3" />
    <p v-else class="tabular-number mt-3 text-2xl font-semibold tracking-tight" :class="TONES[tone].value">
      {{ formatCurrency(value) }}
    </p>

    <div v-if="!loading" class="mt-2 flex items-center gap-2 text-sm">
      <span v-if="change !== null" class="inline-flex items-center gap-1 font-medium" :class="changeColor">
        <TrendingUp v-if="wentUp" class="size-4" aria-hidden="true" />
        <TrendingDown v-else class="size-4" aria-hidden="true" />
        {{ formatPercent(Math.abs(change)) }}
      </span>
      <span class="text-muted-foreground">{{ detail || 'vs. mês anterior' }}</span>
    </div>
  </div>
</template>
