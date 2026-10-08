<script setup lang="ts">
import BaseToggleGroup, { type ToggleOption } from '@/components/common/BaseToggleGroup.vue'

export type ExpenseSource = 'expenses' | 'cards'

defineProps<{
  /** Nome acessível do grupo — diz qual gráfico os botões controlam. */
  label: string
}>()

const source = defineModel<ExpenseSource>({ required: true })

const OPTIONS: ToggleOption<ExpenseSource>[] = [
  { value: 'expenses', label: 'Saídas', title: 'Dados de Saída' },
  { value: 'cards', label: 'Cartões', title: 'Dados de Cartões' },
]
</script>

<template>
  <BaseToggleGroup v-model="source" :options="OPTIONS" :label="label" />
</template>
