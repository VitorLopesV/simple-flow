<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, useId } from 'vue'

import type { SelectOption } from '@/types/common'
import { cn } from '@/utils/cn'

withDefaults(
  defineProps<{
    options: SelectOption<string>[]
    label?: string
    placeholder?: string
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
    /** Exibe a opção vazia (ex.: "Todas as categorias"). */
    allowEmpty?: boolean
  }>(),
  {
    label: '',
    placeholder: 'Selecione',
    error: '',
    hint: '',
    required: false,
    disabled: false,
    allowEmpty: false,
  },
)

const model = defineModel<string | null>({ default: null })

const id = useId()
const errorId = computed(() => `${id}-error`)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="id" class="text-sm font-medium">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <select
        :id="id"
        v-model="model"
        :disabled="disabled"
        :required="required"
        :aria-invalid="Boolean(error) || undefined"
        :aria-describedby="error ? errorId : undefined"
        :class="
          cn(
            'bg-card border-input h-10 w-full appearance-none rounded-lg border pl-3 pr-9 text-sm transition-colors',
            'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30',
            'disabled:cursor-not-allowed disabled:opacity-60',
            !model && 'text-muted-foreground',
            error && 'border-danger focus:border-danger focus:ring-danger/30',
          )
        "
      >
        <option v-if="allowEmpty || !model" :value="null">{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="String(option.value)"
          :value="option.value"
          :disabled="option.disabled"
          class="text-foreground"
        >
          {{ option.label }}
        </option>
      </select>

      <ChevronDown
        class="text-muted-foreground pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>

    <p v-if="error" :id="errorId" class="text-danger text-xs" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="text-muted-foreground text-xs">{{ hint }}</p>
  </div>
</template>
