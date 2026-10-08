<script setup lang="ts" generic="T extends string">
export interface ToggleOption<V extends string = string> {
  value: V
  label: string
  /** Dica exibida ao passar o mouse. */
  title?: string
}

defineProps<{
  /** Nome acessível do grupo — diz o que os botões controlam. */
  label: string
  options: ToggleOption<T>[]
}>()

const selected = defineModel<T>({ required: true })
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
      v-for="option in options"
      :key="option.value"
      type="button"
      :title="option.title"
      :aria-pressed="selected === option.value"
      class="focus-visible:outline-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="
        selected === option.value
          ? 'bg-success text-success-foreground'
          : 'text-muted-foreground hover:bg-success/25 hover:text-foreground'
      "
      @click="selected = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
