<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@/utils/cn'

type Variante = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
type Tamanho = 'sm' | 'md' | 'lg' | 'icon'

const props = withDefaults(
  defineProps<{
    variante?: Variante
    tamanho?: Tamanho
    tipo?: 'button' | 'submit' | 'reset'
    carregando?: boolean
    desabilitado?: boolean
    blocoCompleto?: boolean
  }>(),
  {
    variante: 'primary',
    tamanho: 'md',
    tipo: 'button',
    carregando: false,
    desabilitado: false,
    blocoCompleto: false,
  },
)

const VARIANTES: Record<Variante, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-border bg-card text-foreground hover:bg-muted',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  danger: 'bg-danger text-danger-foreground hover:bg-danger/90 shadow-sm',
  success: 'bg-success text-success-foreground hover:bg-success/90 shadow-sm',
}

const TAMANHOS: Record<Tamanho, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
  icon: 'h-9 w-9 justify-center',
}

const inativo = computed(() => props.desabilitado || props.carregando)

const classes = computed(() =>
  cn(
    'inline-flex items-center rounded-lg font-medium transition-colors',
    'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTES[props.variante],
    TAMANHOS[props.tamanho],
    props.blocoCompleto && 'w-full justify-center',
  ),
)
</script>

<template>
  <button :type="tipo" :class="classes" :disabled="inativo" :aria-busy="carregando || undefined">
    <LoaderCircle v-if="carregando" class="size-4 animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
