<script setup lang="ts">
import { User } from '@lucide/vue'

defineProps<{ fotoUrl?: string | null }>()
</script>

<template>
  <span
    class="bg-muted text-muted-foreground flex shrink-0 items-center justify-center overflow-hidden rounded-full"
  >
    <img v-if="fotoUrl" :src="fotoUrl" alt="" class="size-full object-cover" />
    <User v-else class="size-1/2" aria-hidden="true" />
  </span>
</template>
