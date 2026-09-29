<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
    /** Remove o padding interno do corpo (útil para tabelas coladas na borda). */
    noPadding?: boolean
    /** Em telas médias ou maiores, o card ocupa a altura do pai e o corpo estica (dashboard sem scroll). */
    fill?: boolean
  }>(),
  { title: '', description: '', noPadding: false, fill: false },
)
</script>

<template>
  <section
    class="bg-card text-card-foreground border-border rounded-card min-w-0 border shadow-sm"
    :class="fill && 'md:flex md:h-full md:min-h-0 md:flex-col'"
  >
    <header
      v-if="title || $slots.header || $slots.actions"
      class="border-border flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4"
      :class="fill && 'md:px-4 md:py-2.5'"
    >
      <div class="min-w-0">
        <slot name="header">
          <h2 class="truncate text-base font-semibold">{{ title }}</h2>
          <p v-if="description" class="text-muted-foreground mt-0.5 text-sm" :class="fill && 'md:hidden'">
            {{ description }}
          </p>
        </slot>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </header>

    <div :class="[noPadding ? '' : fill ? 'p-5 md:p-3' : 'p-5', fill && 'md:min-h-0 md:flex-1']">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="border-border border-t px-5 py-3">
      <slot name="footer" />
    </footer>
  </section>
</template>
