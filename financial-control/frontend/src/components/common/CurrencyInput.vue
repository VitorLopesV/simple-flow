<script setup lang="ts">
import { ref, watch } from 'vue'

import { formatDecimal, parseCurrency } from '@/utils/currencyFormatter'
import BaseInput from './BaseInput.vue'

withDefaults(
  defineProps<{
    label?: string
    erro?: string
    dica?: string
    obrigatorio?: boolean
    placeholder?: string
  }>(),
  { label: 'Valor', erro: '', dica: '', obrigatorio: false, placeholder: '0,00' },
)

/** O modelo é sempre numérico; a máscara pt-BR vive apenas no texto exibido. */
const modelo = defineModel<number>({ default: 0 })

const emit = defineEmits<{ blur: [] }>()

const texto = ref(modelo.value ? formatDecimal(modelo.value) : '')

// Sincroniza quando o valor muda por fora (ex.: abrir o form em modo edição).
watch(modelo, (valor) => {
  if (parseCurrency(texto.value) !== valor) texto.value = valor ? formatDecimal(valor) : ''
})

watch(texto, (valor) => {
  modelo.value = parseCurrency(valor)
})

function aoSair(): void {
  texto.value = modelo.value ? formatDecimal(modelo.value) : ''
  emit('blur')
}
</script>

<template>
  <BaseInput
    v-model="texto"
    :label="label"
    :erro="erro"
    :dica="dica"
    :obrigatorio="obrigatorio"
    :placeholder="placeholder"
    inputmode="decimal"
    alinhar-direita
    @blur="aoSair"
  >
    <template #prefixo>R$</template>
  </BaseInput>
</template>
