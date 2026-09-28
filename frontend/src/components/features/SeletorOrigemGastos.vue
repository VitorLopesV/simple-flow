<script setup lang="ts">
export type OrigemGastos = 'saidas' | 'cartoes'

defineProps<{
  /** Nome acessível do grupo — diz qual gráfico os botões controlam. */
  rotulo: string
}>()

const origem = defineModel<OrigemGastos>({ required: true })

const OPCOES: { valor: OrigemGastos; rotulo: string; titulo: string }[] = [
  { valor: 'saidas', rotulo: 'Saídas', titulo: 'Dados de Saída' },
  { valor: 'cartoes', rotulo: 'Cartões', titulo: 'Dados de Cartões' },
]
</script>

<template>
  <!-- `-my-1`: o grupo é mais alto que o título, e sem isso o cabeçalho do card cresce
       e desalinha a borda em relação aos cards vizinhos. -->
  <div
    class="border-border -my-1 flex items-center gap-0.5 rounded-lg border p-0.5"
    role="group"
    :aria-label="rotulo"
  >
    <button
      v-for="opcao in OPCOES"
      :key="opcao.valor"
      type="button"
      :title="opcao.titulo"
      :aria-pressed="origem === opcao.valor"
      class="focus-visible:outline-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="
        origem === opcao.valor
          ? 'bg-success text-success-foreground'
          : 'text-muted-foreground hover:bg-success/25 hover:text-foreground'
      "
      @click="origem = opcao.valor"
    >
      {{ opcao.rotulo }}
    </button>
  </div>
</template>
