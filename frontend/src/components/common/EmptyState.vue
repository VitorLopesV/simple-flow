<script setup lang="ts">
import { Inbox } from '@lucide/vue'

withDefaults(defineProps<{ titulo: string; descricao?: string; compacto?: boolean }>(), {
  descricao: '',
  compacto: false,
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 px-6 text-center"
    :class="compacto ? 'py-6 md:h-full md:py-1' : 'py-12'"
  >
    <div class="bg-muted text-muted-foreground rounded-full p-3">
      <slot name="icone">
        <Inbox class="size-6" aria-hidden="true" />
      </slot>
    </div>
    <div>
      <p class="font-medium">{{ titulo }}</p>
      <p v-if="descricao" class="text-muted-foreground mt-1 max-w-sm text-sm">{{ descricao }}</p>
    </div>
    <slot name="acao" />
  </div>
</template>
