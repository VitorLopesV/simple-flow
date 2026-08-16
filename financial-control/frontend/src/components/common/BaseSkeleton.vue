<script setup lang="ts">
withDefaults(defineProps<{ linhas?: number; altura?: string }>(), { linhas: 1, altura: 'h-4' })
</script>

<template>
  <div class="flex flex-col gap-2" role="status" aria-label="Carregando">
    <div
      v-for="linha in linhas"
      :key="linha"
      class="bg-muted animate-pulse rounded"
      :class="[altura, linha === linhas && linhas > 1 ? 'w-2/3' : 'w-full']"
    />
    <span class="sr-only">Carregando…</span>
  </div>
</template>
