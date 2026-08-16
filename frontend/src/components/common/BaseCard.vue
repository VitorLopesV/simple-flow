<script setup lang="ts">
withDefaults(
  defineProps<{
    titulo?: string
    descricao?: string
    /** Remove o padding interno do corpo (útil para tabelas coladas na borda). */
    semPadding?: boolean
  }>(),
  { titulo: '', descricao: '', semPadding: false },
)
</script>

<template>
  <section class="bg-card text-card-foreground border-border rounded-card border shadow-sm">
    <header
      v-if="titulo || $slots.cabecalho || $slots.acoes"
      class="border-border flex items-start justify-between gap-4 border-b px-5 py-4"
    >
      <div class="min-w-0">
        <slot name="cabecalho">
          <h2 class="truncate text-base font-semibold">{{ titulo }}</h2>
          <p v-if="descricao" class="text-muted-foreground mt-0.5 text-sm">{{ descricao }}</p>
        </slot>
      </div>
      <div v-if="$slots.acoes" class="flex shrink-0 items-center gap-2">
        <slot name="acoes" />
      </div>
    </header>

    <div :class="semPadding ? '' : 'p-5'">
      <slot />
    </div>

    <footer v-if="$slots.rodape" class="border-border border-t px-5 py-3">
      <slot name="rodape" />
    </footer>
  </section>
</template>
