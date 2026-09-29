<script setup lang="ts">
import { useId } from 'vue'

import { cn } from '@/utils/cn'

withDefaults(
  defineProps<{
    label?: string
    placeholder?: string
    error?: string
    rows?: number
    maxlength?: number
  }>(),
  { label: '', placeholder: '', error: '', rows: 3, maxlength: 280 },
)

const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="id" class="text-sm font-medium">{{ label }}</label>
    <textarea
      :id="id"
      v-model="model"
      :rows="rows"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :aria-invalid="Boolean(error) || undefined"
      :class="
        cn(
          'bg-card border-input w-full resize-y rounded-lg border px-3 py-2 text-sm transition-colors',
          'placeholder:text-muted-foreground/70',
          'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30',
          error && 'border-danger',
        )
      "
    />
    <p v-if="error" class="text-danger text-xs" role="alert">{{ error }}</p>
  </div>
</template>
