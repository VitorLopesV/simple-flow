<script setup lang="ts">
import { computed } from 'vue'

import type { RoutineItem } from '@/types/routine'
import { toDate, toISODate } from '@/utils/dateFormatter'
import { upcomingOccurrences } from '@/utils/routineOccurrences'

const props = withDefaults(
  defineProps<{
    item: Pick<RoutineItem, 'repeat' | 'times'>
    /** Dia de partida (`YYYY-MM-DD`); o padrão é hoje. Existe para os testes serem determinísticos. */
    from?: string
    limit?: number
  }>(),
  { from: undefined, limit: 5 },
)

const occurrences = computed(() =>
  upcomingOccurrences(props.item, props.from ?? toISODate(new Date()), props.limit),
)

/** `'2026-11-17'` -> `'ter., 17/11'` (ao meio-dia local, sem bug de fuso). */
function dayLabel(iso: string): string {
  return toDate(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}
</script>

<template>
  <div data-testid="routine-preview">
    <p class="text-muted-foreground mb-1 text-xs font-medium">Próximas ocorrências</p>
    <ul v-if="occurrences.length" class="flex flex-wrap gap-1.5">
      <li
        v-for="(occurrence, index) in occurrences"
        :key="`${occurrence.date}-${occurrence.time ?? ''}-${index}`"
        class="rounded-full border px-2 py-0.5 text-xs"
        :class="occurrence.reminder ? 'border-warning/40 text-warning' : 'border-border text-foreground'"
        :data-testid="occurrence.reminder ? 'occurrence-reminder' : 'occurrence'"
      >
        {{ dayLabel(occurrence.date) }}{{ occurrence.time ? ` às ${occurrence.time}` : '' }}
        <span v-if="occurrence.reminder">· lembrete</span>
      </li>
    </ul>
    <p v-else class="text-muted-foreground text-xs">Nenhuma ocorrência nos próximos dias.</p>
  </div>
</template>
