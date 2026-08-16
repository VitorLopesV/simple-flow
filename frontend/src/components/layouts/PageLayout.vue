<script setup lang="ts">
withDefaults(defineProps<{ titulo: string; descricao?: string }>(), { descricao: '' })
</script>

<template>
  <div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h2 class="text-xl font-semibold tracking-tight sm:text-2xl">{{ titulo }}</h2>
        <p v-if="descricao" class="text-muted-foreground mt-1 text-sm">{{ descricao }}</p>
      </div>

      <div v-if="$slots.acoes" class="flex flex-wrap items-center gap-2">
        <slot name="acoes" />
      </div>
    </div>

    <slot />
  </div>
</template>
