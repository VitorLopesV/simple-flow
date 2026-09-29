<script setup lang="ts">
import { Inbox } from '@lucide/vue'

withDefaults(defineProps<{ title: string; description?: string; compact?: boolean }>(), {
  description: '',
  compact: false,
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 px-6 text-center"
    :class="compact ? 'py-6 md:h-full md:py-1' : 'py-12'"
  >
    <div class="bg-muted text-muted-foreground rounded-full p-3">
      <slot name="icon">
        <Inbox class="size-6" aria-hidden="true" />
      </slot>
    </div>
    <div>
      <p class="font-medium">{{ title }}</p>
      <p v-if="description" class="text-muted-foreground mt-1 max-w-sm text-sm">{{ description }}</p>
    </div>
    <slot name="action" />
  </div>
</template>
