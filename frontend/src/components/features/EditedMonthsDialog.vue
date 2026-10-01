<script setup lang="ts">
import { computed } from 'vue'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { formatPeriod, fromReferenceMonth } from '@/utils/dateFormatter'

/**
 * Confirmação exigida quando excluir um mês de uma série recorrente — ou desligar a
 * recorrência — removeria meses seguintes que o usuário já alterou (valor, situação...).
 */
const props = withDefaults(
  defineProps<{
    /** `remove` = excluir o mês; `deactivate` = desligar a recorrência (o mês fica). */
    action: 'remove' | 'deactivate'
    /** Competências `YYYY-MM` dos meses seguintes alterados. */
    months: string[]
    description?: string
    loading?: boolean
  }>(),
  { description: '', loading: false },
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const monthLabels = computed(() => props.months.map((month) => formatPeriod(fromReferenceMonth(month))))

const message = computed(() => {
  const name = props.description ? `“${props.description}”` : 'Este lançamento'
  const plural = props.months.length > 1
  return `${name} tem ${plural ? 'meses seguintes alterados' : 'um mês seguinte alterado'} na série:`
})

const consequence = computed(() =>
  props.action === 'remove'
    ? 'Excluir remove este mês e todos os seguintes da série, inclusive os alterados.'
    : 'Desligar a recorrência mantém este mês e remove todos os seguintes da série, inclusive os alterados.',
)
</script>

<template>
  <ConfirmDialog
    v-model:open="open"
    title="Meses seguintes alterados"
    :message="message"
    confirm-text="Remover mesmo assim"
    :loading="loading"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <ul class="text-foreground list-disc pl-5 font-medium" aria-label="Meses alterados">
      <li v-for="label in monthLabels" :key="label">{{ label }}</li>
    </ul>
    <p class="text-muted-foreground">{{ consequence }}</p>
    <p class="text-muted-foreground">Os meses anteriores não são afetados.</p>
  </ConfirmDialog>
</template>
