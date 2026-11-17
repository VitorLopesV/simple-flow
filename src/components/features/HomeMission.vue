<script setup lang="ts">
import { BellRing, Check, Circle } from '@lucide/vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseProgressBar from '@/components/common/BaseProgressBar.vue'
import type { HomeOccurrence } from '@/types/home'
import { formatDate } from '@/utils/dateFormatter'

/**
 * Missão do dia (checklist da rotina) e, no fim de semana, os lembretes de rotina. Concluir só
 * pede a confirmação à tela: a conclusão é definitiva e quem decide é o `Home.vue`.
 */
const props = defineProps<{
  today: string
  completed: number
  total: number
  occurrences: HomeOccurrence[]
  reminders: HomeOccurrence[]
  /** Fim de semana: o sprint já fechou e não há missão do dia. */
  weekend?: boolean
  busy?: boolean
}>()

const emit = defineEmits<{ complete: [occurrence: HomeOccurrence] }>()

/** O backend só conclui a rotina no próprio dia; os demais lembretes ficam só para consulta. */
function canComplete(entry: HomeOccurrence): boolean {
  return !entry.done && entry.id !== null && entry.date === props.today && !props.busy
}
</script>

<template>
  <BaseCard title="Missão do dia" data-testid="home-mission">
    <div class="flex flex-col gap-4">
      <template v-if="total">
        <div>
          <p class="text-muted-foreground mb-1 text-sm tabular-nums" data-testid="mission-progress-text">
            {{ completed }} de {{ total }} {{ total === 1 ? 'item' : 'itens' }}
          </p>
          <BaseProgressBar :value="(completed / total) * 100" label="Progresso da missão do dia" />
        </div>
      </template>

      <p v-if="!total" class="text-muted-foreground text-sm" data-testid="mission-empty">
        {{ weekend ? 'Fim de semana: a rotina do sprint é de segunda a sexta.' : 'Nenhum item de rotina para hoje.' }}
      </p>

      <ul v-else class="flex flex-col gap-1" aria-label="Itens da rotina de hoje">
        <li v-for="entry in occurrences" :key="entry.id ?? `${entry.name}-${entry.time}`" data-testid="mission-item">
          <button
            type="button"
            class="hover:bg-muted focus-visible:outline-ring flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm focus-visible:outline-2 disabled:cursor-default disabled:hover:bg-transparent"
            :disabled="!canComplete(entry)"
            :aria-label="entry.done ? `${entry.name}: concluído` : `Concluir ${entry.name}`"
            @click="emit('complete', entry)"
          >
            <Check v-if="entry.done" class="text-success size-5 shrink-0" aria-hidden="true" />
            <Circle v-else class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
            <span class="min-w-0 flex-1 wrap-break-word" :class="entry.done && 'text-muted-foreground line-through'">
              {{ entry.name }}
            </span>
            <span v-if="entry.time" class="text-muted-foreground tabular-nums text-xs">{{ entry.time }}</span>
          </button>
        </li>
      </ul>

      <section v-if="reminders.length" aria-label="Lembretes de rotina" data-testid="home-reminders">
        <h3 class="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-semibold uppercase">
          <BellRing class="size-3.5" aria-hidden="true" />
          Lembretes
          <BaseBadge>Sem pontos</BaseBadge>
        </h3>
        <ul class="flex flex-col gap-1">
          <li v-for="entry in reminders" :key="entry.id ?? `${entry.name}-${entry.date}`" data-testid="reminder-item">
            <button
              type="button"
              class="hover:bg-muted focus-visible:outline-ring flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm focus-visible:outline-2 disabled:cursor-default disabled:hover:bg-transparent"
              :disabled="!canComplete(entry)"
              :aria-label="entry.done ? `${entry.name}: concluído` : `Concluir lembrete ${entry.name}`"
              @click="emit('complete', entry)"
            >
              <Check v-if="entry.done" class="text-success size-5 shrink-0" aria-hidden="true" />
              <Circle v-else class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
              <span class="min-w-0 flex-1 wrap-break-word" :class="entry.done && 'text-muted-foreground line-through'">
                {{ entry.name }}
              </span>
              <span class="text-muted-foreground tabular-nums text-xs">
                {{ formatDate(entry.date).slice(0, 5) }}<template v-if="entry.time"> · {{ entry.time }}</template>
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </BaseCard>
</template>
