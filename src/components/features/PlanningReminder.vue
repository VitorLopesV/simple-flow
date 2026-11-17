<script setup lang="ts">
import { CalendarClock } from '@lucide/vue'
import { computed } from 'vue'

import { isSundayInSaoPaulo } from '@/utils/sprint'

const props = withDefaults(
  defineProps<{
    /** Instante de referência; o padrão é agora. Existe para os testes serem determinísticos. */
    now?: Date
  }>(),
  { now: undefined },
)

/** O domingo é calculado em America/Sao_Paulo, não pelo fuso do navegador. */
const visible = computed(() => isSundayInSaoPaulo(props.now ?? new Date()))
</script>

<template>
  <div
    v-if="visible"
    class="bg-primary/10 border-primary/30 rounded-card flex flex-wrap items-center gap-3 border p-4"
    role="status"
    data-testid="planning-reminder"
  >
    <CalendarClock class="text-primary size-5 shrink-0" aria-hidden="true" />
    <p class="min-w-0 flex-1 text-sm">
      <strong>Hoje é dia de planejar a semana.</strong>
      Defina a recompensa e escolha as tarefas do próximo sprint.
    </p>
    <slot name="actions" />
  </div>
</template>
