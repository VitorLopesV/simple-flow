<script setup lang="ts">
import { computed, useId } from 'vue'

import { cn } from '@/utils/cn'

// Listeners e atributos extras (@blur, autocomplete...) vão para o <input>,
// não para o wrapper.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    label?: string
    type?: string
    placeholder?: string
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
    /** Alinha o texto à direita — usado em campos de valor. */
    alignRight?: boolean
    inputmode?: 'text' | 'decimal' | 'numeric' | 'search'
    max?: string | number
    min?: string | number
    maxlength?: number
  }>(),
  {
    label: '',
    type: 'text',
    placeholder: '',
    error: '',
    hint: '',
    required: false,
    disabled: false,
    alignRight: false,
    inputmode: 'text',
  },
)

const model = defineModel<string | number | null>({ default: '' })

const id = useId()
const errorId = computed(() => `${id}-error`)
const hintId = computed(() => `${id}-hint`)

const describedBy = computed(() => {
  const parts: string[] = []
  if (props.error) parts.push(errorId.value)
  if (props.hint) parts.push(hintId.value)
  return parts.length ? parts.join(' ') : undefined
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="id" class="text-sm font-medium">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <span
        v-if="$slots.prefix"
        class="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm"
      >
        <slot name="prefix" />
      </span>

      <input
        :id="id"
        v-bind="$attrs"
        v-model="model"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :inputmode="inputmode"
        :max="max"
        :min="min"
        :maxlength="maxlength"
        :aria-invalid="Boolean(error) || undefined"
        :aria-describedby="describedBy"
        :class="
          cn(
            'bg-card border-input h-10 w-full rounded-lg border px-3 text-sm transition-colors',
            'placeholder:text-muted-foreground/70',
            'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30',
            'disabled:cursor-not-allowed disabled:opacity-60',
            $slots.prefix && 'pl-10',
            $slots.suffix && 'pr-10',
            alignRight && 'text-right tabular-number',
            error && 'border-danger focus:border-danger focus:ring-danger/30',
          )
        "
      />

      <span v-if="$slots.suffix" class="absolute inset-y-0 right-1.5 flex items-center">
        <slot name="suffix" />
      </span>
    </div>

    <p v-if="error" :id="errorId" class="text-danger text-xs" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" class="text-muted-foreground text-xs">{{ hint }}</p>
  </div>
</template>
