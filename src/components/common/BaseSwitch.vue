<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{ label?: string; description?: string; disabled?: boolean }>(), {
  label: '',
  description: '',
  disabled: false,
})

const model = defineModel<boolean>({ default: false })
const id = useId()
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <span class="flex flex-col">
      <label :for="id" class="text-sm font-medium" :class="disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'">
        {{ label }}
      </label>
      <span v-if="description" class="text-muted-foreground text-xs">{{ description }}</span>
    </span>

    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="model"
      :aria-label="label || undefined"
      :disabled="disabled"
      class="focus-visible:outline-ring relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      :class="model ? 'bg-primary' : 'bg-input'"
      @click="model = !model"
    >
      <span
        class="bg-card absolute top-0.5 left-0.5 size-5 rounded-full shadow transition-transform"
        :class="model ? 'translate-x-5' : 'translate-x-0'"
      />
    </button>
  </div>
</template>
