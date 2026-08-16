<script setup lang="ts">
import { TrendingDown, TrendingUp } from '@lucide/vue'
import type { Component } from 'vue'
import { computed } from 'vue'

import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import { formatCurrency, formatPercent } from '@/utils/currencyFormatter'

type Tom = 'neutro' | 'sucesso' | 'perigo' | 'info' | 'aviso'

const props = withDefaults(
  defineProps<{
    rotulo: string
    valor: number
    icone?: Component | null
    tom?: Tom
    /** Variação em fração (0.12 = +12%) em relação ao mês anterior. */
    variacao?: number | null
    /** Quando a métrica é uma despesa, subir é ruim: inverte as cores. */
    variacaoInvertida?: boolean
    detalhe?: string
    carregando?: boolean
  }>(),
  {
    icone: null,
    tom: 'neutro',
    variacao: null,
    variacaoInvertida: false,
    detalhe: '',
    carregando: false,
  },
)

const TONS: Record<Tom, { icone: string; valor: string }> = {
  neutro: { icone: 'bg-muted text-muted-foreground', valor: 'text-foreground' },
  sucesso: { icone: 'bg-success-soft text-success', valor: 'text-success' },
  perigo: { icone: 'bg-danger-soft text-danger', valor: 'text-danger' },
  info: { icone: 'bg-primary/10 text-primary', valor: 'text-foreground' },
  aviso: { icone: 'bg-warning-soft text-warning', valor: 'text-foreground' },
}

const subiu = computed(() => (props.variacao ?? 0) >= 0)

const corVariacao = computed(() => {
  const positivo = props.variacaoInvertida ? !subiu.value : subiu.value
  return positivo ? 'text-success' : 'text-danger'
})
</script>

<template>
  <div class="bg-card border-border rounded-card border p-5 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <p class="text-muted-foreground text-sm font-medium">{{ rotulo }}</p>
      <span v-if="icone" class="rounded-lg p-2" :class="TONS[tom].icone">
        <component :is="icone" class="size-4" aria-hidden="true" />
      </span>
    </div>

    <BaseSkeleton v-if="carregando" altura="h-8" class="mt-3" />
    <p v-else class="numero-tabular mt-3 text-2xl font-semibold tracking-tight" :class="TONS[tom].valor">
      {{ formatCurrency(valor) }}
    </p>

    <div v-if="!carregando" class="mt-2 flex items-center gap-2 text-xs">
      <span v-if="variacao !== null" class="inline-flex items-center gap-1 font-medium" :class="corVariacao">
        <TrendingUp v-if="subiu" class="size-3.5" aria-hidden="true" />
        <TrendingDown v-else class="size-3.5" aria-hidden="true" />
        {{ formatPercent(Math.abs(variacao)) }}
      </span>
      <span class="text-muted-foreground">{{ detalhe || 'vs. mês anterior' }}</span>
    </div>
  </div>
</template>
