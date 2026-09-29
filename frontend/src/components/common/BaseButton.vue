<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@/utils/cn'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    fullWidth?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    loading: false,
    disabled: false,
    fullWidth: false,
  },
)

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-success/25 hover:text-foreground shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-success/25 hover:text-foreground',
  outline: 'border border-border bg-card text-foreground hover:bg-success/25',
  ghost: 'text-muted-foreground hover:bg-success/25 hover:text-foreground',
  danger: 'bg-danger text-danger-foreground hover:bg-success/25 hover:text-foreground shadow-sm',
  success: 'bg-success text-success-foreground hover:bg-success/25 hover:text-foreground shadow-sm',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
  icon: 'h-9 w-9 justify-center',
}

const inactive = computed(() => props.disabled || props.loading)

const classes = computed(() =>
  cn(
    'inline-flex items-center rounded-lg font-medium transition-colors',
    'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[props.variant],
    SIZES[props.size],
    props.fullWidth && 'w-full justify-center',
  ),
)
</script>

<template>
  <button :type="type" :class="classes" :disabled="inactive" :aria-busy="loading || undefined">
    <LoaderCircle v-if="loading" class="size-4 animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
