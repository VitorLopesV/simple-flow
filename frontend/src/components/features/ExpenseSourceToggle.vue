<script setup lang="ts">
export type ExpenseSource = 'expenses' | 'cards'

defineProps<{
  /** Nome acessível do grupo — diz qual gráfico os botões controlam. */
  label: string
}>()

const source = defineModel<ExpenseSource>({ required: true })

const OPTIONS: { value: ExpenseSource; label: string; title: string }[] = [
  { value: 'expenses', label: 'Saídas', title: 'Dados de Saída' },
  { value: 'cards', label: 'Cartões', title: 'Dados de Cartões' },
]
</script>

<template>
  <!-- `-my-1`: o grupo é mais alto que o título, e sem isso o cabeçalho do card cresce
       e desalinha a borda em relação aos cards vizinhos. -->
  <div
    class="border-border -my-1 flex items-center gap-0.5 rounded-lg border p-0.5"
    role="group"
    :aria-label="label"
  >
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      :title="option.title"
      :aria-pressed="source === option.value"
      class="focus-visible:outline-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="
        source === option.value
          ? 'bg-success text-success-foreground'
          : 'text-muted-foreground hover:bg-success/25 hover:text-foreground'
      "
      @click="source = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
