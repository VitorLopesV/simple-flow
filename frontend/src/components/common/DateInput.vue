<script setup lang="ts">
import { ref, watch } from 'vue'

import { mascararDataBR, paraISODataBR, paraMascaraDataBR } from '@/utils/dateFormatter'
import BaseInput from './BaseInput.vue'

withDefaults(
  defineProps<{
    label?: string
    erro?: string
    dica?: string
    obrigatorio?: boolean
  }>(),
  { label: 'Data', erro: '', dica: '', obrigatorio: false },
)

/** O modelo é sempre ISO (`aaaa-mm-dd`); a máscara dd/mm/aaaa vive apenas no texto exibido. */
const modelo = defineModel<string>({ default: '' })

const emit = defineEmits<{ blur: [] }>()

const texto = ref(paraMascaraDataBR(modelo.value))

// Sincroniza quando o valor muda por fora (ex.: abrir o form em modo edição).
watch(modelo, (valor) => {
  if (paraISODataBR(texto.value) !== valor) texto.value = paraMascaraDataBR(valor)
})

watch(texto, (valor) => {
  const mascarada = mascararDataBR(valor)
  if (mascarada !== valor) {
    texto.value = mascarada
    return
  }
  const iso = paraISODataBR(mascarada)
  if (iso) modelo.value = iso
})
</script>

<template>
  <BaseInput
    v-model="texto"
    :label="label"
    placeholder="dd/mm/aaaa"
    :erro="erro"
    :dica="dica"
    :obrigatorio="obrigatorio"
    inputmode="numeric"
    :maxlength="10"
    autocomplete="off"
    @blur="emit('blur')"
  />
</template>
