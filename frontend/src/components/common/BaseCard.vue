<script setup lang="ts">
withDefaults(
  defineProps<{
    titulo?: string
    descricao?: string
    /** Remove o padding interno do corpo (útil para tabelas coladas na borda). */
    semPadding?: boolean
    /** Em telas médias ou maiores, o card ocupa a altura do pai e o corpo estica (dashboard sem scroll). */
    preencher?: boolean
  }>(),
  { titulo: '', descricao: '', semPadding: false, preencher: false },
)
</script>

<template>
  <section
    class="bg-card text-card-foreground border-border rounded-card min-w-0 border shadow-sm"
    :class="preencher && 'md:flex md:h-full md:min-h-0 md:flex-col'"
  >
    <header
      v-if="titulo || $slots.cabecalho || $slots.acoes"
      class="border-border flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4"
      :class="preencher && 'md:px-4 md:py-2.5'"
    >
      <div class="min-w-0">
        <slot name="cabecalho">
          <h2 class="truncate text-base font-semibold">{{ titulo }}</h2>
          <p v-if="descricao" class="text-muted-foreground mt-0.5 text-sm" :class="preencher && 'md:hidden'">
            {{ descricao }}
          </p>
        </slot>
      </div>
      <div v-if="$slots.acoes" class="flex shrink-0 items-center gap-2">
        <slot name="acoes" />
      </div>
    </header>

    <div :class="[semPadding ? '' : preencher ? 'p-5 md:p-3' : 'p-5', preencher && 'md:min-h-0 md:flex-1']">
      <slot />
    </div>

    <footer v-if="$slots.rodape" class="border-border border-t px-5 py-3">
      <slot name="rodape" />
    </footer>
  </section>
</template>
