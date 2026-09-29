<script setup lang="ts">
import { ref, watch } from 'vue'

import { formatDecimal, parseCurrency } from '@/utils/currencyFormatter'
import BaseInput from './BaseInput.vue'

withDefaults(
  defineProps<{
    label?: string
    error?: string
    hint?: string
    required?: boolean
    placeholder?: string
  }>(),
  { label: 'Valor', error: '', hint: '', required: false, placeholder: '0,00' },
)

/** O modelo é sempre numérico; a máscara pt-BR vive apenas no texto exibido. */
const model = defineModel<number>({ default: 0 })

const emit = defineEmits<{ blur: [] }>()

const text = ref(model.value ? formatDecimal(model.value) : '')

// Sincroniza quando o valor muda por fora (ex.: abrir o form em modo edição).
watch(model, (value) => {
  if (parseCurrency(text.value) !== value) text.value = value ? formatDecimal(value) : ''
})

watch(text, (value) => {
  model.value = parseCurrency(value)
})

function onBlur(): void {
  text.value = model.value ? formatDecimal(model.value) : ''
  emit('blur')
}
</script>

<template>
  <BaseInput
    v-model="text"
    :label="label"
    :error="error"
    :hint="hint"
    :required="required"
    :placeholder="placeholder"
    inputmode="decimal"
    align-right
    @blur="onBlur"
  >
    <template #prefix>R$</template>
  </BaseInput>
</template>
