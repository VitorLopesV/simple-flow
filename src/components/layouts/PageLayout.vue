<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string }>(), { description: '' })
</script>

<template>
  <div class="flex w-full flex-col gap-6">
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">{{ title }}</h1>
        <p v-if="description" class="text-muted-foreground mt-1 text-sm">{{ description }}</p>
      </div>

      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <slot />
  </div>
</template>
