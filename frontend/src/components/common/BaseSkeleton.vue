<script setup lang="ts">
withDefaults(defineProps<{ lines?: number; height?: string }>(), { lines: 1, height: 'h-4' })
</script>

<template>
  <div class="flex flex-col gap-2" role="status" aria-label="Carregando">
    <div
      v-for="line in lines"
      :key="line"
      class="bg-muted animate-pulse rounded"
      :class="[height, line === lines && lines > 1 ? 'w-2/3' : 'w-full']"
    />
    <span class="sr-only">Carregando…</span>
  </div>
</template>
