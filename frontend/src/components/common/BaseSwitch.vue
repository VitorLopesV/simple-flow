<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{ label?: string; descricao?: string }>(), { label: '', descricao: '' })

const modelo = defineModel<boolean>({ default: false })
const id = useId()
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <span class="flex flex-col">
      <label :for="id" class="cursor-pointer text-sm font-medium">{{ label }}</label>
      <span v-if="descricao" class="text-muted-foreground text-xs">{{ descricao }}</span>
    </span>

    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="modelo"
      :aria-label="label || undefined"
      class="focus-visible:outline-ring relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="modelo ? 'bg-primary' : 'bg-input'"
      @click="modelo = !modelo"
    >
      <span
        class="bg-card absolute top-0.5 left-0.5 size-5 rounded-full shadow transition-transform"
        :class="modelo ? 'translate-x-5' : 'translate-x-0'"
      />
    </button>
  </div>
</template>
