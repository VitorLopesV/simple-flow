<script setup lang="ts">
import { Check, ChevronDown, Gift, Trophy, X } from '@lucide/vue'
import { computed, ref, useId } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import SprintScoreboard from '@/components/features/SprintScoreboard.vue'
import type { SprintHistoryEntry, SprintTaskOutcome } from '@/types/sprint'
import { historyScoreboard, SPRINT_TASK_OUTCOME_LABEL } from '@/types/sprint'
import { formatDate, toDate } from '@/utils/dateFormatter'

const props = defineProps<{ entry: SprintHistoryEntry }>()

const open = ref(false)
const panelId = `history-${useId()}`

const period = computed(() => `${formatDate(props.entry.startDate)} a ${formatDate(props.entry.endDate)}`)
const percentage = computed(
  () => `${props.entry.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`,
)
const scoreboard = computed(() => historyScoreboard(props.entry))
/** `completed` da API inclui as atrasadas; aqui separamos para o resumo. */
const onTimeCount = computed(() => props.entry.tasks.completed - props.entry.tasks.late)

const OUTCOME_TONE: Record<SprintTaskOutcome, 'success' | 'warning' | 'danger'> = {
  CONCLUIDA: 'success',
  ATRASADA: 'warning',
  NAO_CONCLUIDA: 'danger',
}

function weekday(iso: string): string {
  return toDate(iso).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}
</script>

<template>
  <article class="bg-card border-border rounded-card border" :data-testid="`history-${entry.sprintId}`">
    <button
      type="button"
      class="focus-visible:outline-ring flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-[inherit] p-4 text-left focus-visible:outline-2"
      :aria-expanded="open"
      :aria-controls="panelId"
      :data-testid="`history-toggle-${entry.sprintId}`"
      @click="open = !open"
    >
      <span class="min-w-0 flex-1">
        <span class="block font-medium">{{ period }}</span>
        <span class="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Gift class="size-3.5 shrink-0" aria-hidden="true" />
          <span v-if="entry.reward" data-testid="history-reward">Recompensa: {{ entry.reward }}</span>
          <span v-else data-testid="history-reward">Sem recompensa</span>
        </span>
      </span>
      <span class="text-sm tabular-nums" data-testid="history-points">
        <span class="font-semibold">{{ entry.done }}</span>
        <span class="text-muted-foreground"> / {{ entry.total }} pts · {{ percentage }}</span>
      </span>
      <!-- O selo vem do campo `bonus`, nunca do percentual arredondado (89,96% mostra 90,0 sem bônus). -->
      <BaseBadge v-if="entry.bonus" tone="success" data-testid="history-bonus">
        <Trophy class="size-3.5" aria-hidden="true" />
        Bônus liberado
      </BaseBadge>
      <BaseBadge v-else data-testid="history-no-bonus">Sem bônus</BaseBadge>
      <BaseBadge v-if="entry.rewardEarned" tone="success" data-testid="history-reward-earned">
        Recompensa conquistada
      </BaseBadge>
      <ChevronDown
        class="text-muted-foreground size-4 shrink-0 transition-transform motion-reduce:transition-none"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
      <span class="sr-only">{{ open ? 'Ocultar detalhes' : 'Ver detalhes' }}</span>
    </button>

    <div
      v-if="open"
      :id="panelId"
      class="border-border flex flex-col gap-4 border-t p-4"
      :data-testid="`history-detail-${entry.sprintId}`"
    >
      <SprintScoreboard :scoreboard="scoreboard" closed :reward="entry.reward" />

      <section aria-label="Tarefas do sprint" class="flex flex-col gap-2">
        <h3 class="text-sm font-semibold">Tarefas</h3>
        <p class="text-muted-foreground text-sm" data-testid="history-task-summary">
          {{ onTimeCount }} concluídas · {{ entry.tasks.late }} atrasadas · {{ entry.tasks.notCompleted }} não concluídas
        </p>
        <p v-if="entry.tasks.items.length === 0" class="text-muted-foreground text-sm">Nenhuma tarefa neste sprint.</p>
        <ul v-else class="flex flex-col gap-1.5">
          <li
            v-for="task in entry.tasks.items"
            :key="task.id"
            class="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm"
            data-testid="history-task"
          >
            <span class="min-w-0 flex-1 truncate">{{ task.title }}</span>
            <span v-if="task.day" class="text-muted-foreground text-xs">{{ formatDate(task.day) }}</span>
            <span class="text-muted-foreground text-xs tabular-nums">{{ task.earnedPoints }}/{{ task.points }} pts</span>
            <BaseBadge :tone="OUTCOME_TONE[task.outcome]">{{ SPRINT_TASK_OUTCOME_LABEL[task.outcome] }}</BaseBadge>
          </li>
        </ul>
      </section>

      <section aria-label="Rotina por dia" class="flex flex-col gap-2">
        <h3 class="text-sm font-semibold">Rotina</h3>
        <p v-if="entry.routine.days.length === 0" class="text-muted-foreground text-sm">Nenhuma rotina neste sprint.</p>
        <ul v-else class="flex flex-col gap-1.5">
          <li
            v-for="day in entry.routine.days"
            :key="day.date"
            class="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm"
            data-testid="history-routine-day"
          >
            <component
              :is="day.completed ? Check : X"
              class="size-4 shrink-0"
              :class="day.completed ? 'text-success' : 'text-danger'"
              aria-hidden="true"
            />
            <span class="font-medium capitalize">{{ weekday(day.date) }} {{ formatDate(day.date).slice(0, 5) }}</span>
            <span class="text-muted-foreground min-w-0 flex-1 truncate">
              {{ day.items.map((item) => item.name).join(', ') }}
            </span>
            <BaseBadge :tone="day.completed ? 'success' : 'danger'">
              {{ day.completed ? 'Cumprida' : 'Não cumprida' }}
            </BaseBadge>
          </li>
        </ul>
      </section>
    </div>
  </article>
</template>
