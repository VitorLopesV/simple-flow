<script setup lang="ts">
import { CircleCheck, Clock } from '@lucide/vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import type { HomeTask } from '@/types/home'
import { formatMinutes } from '@/utils/sprint'
import { fullPoints, latePoints } from '@/utils/taskCompletion'

/** Tarefas de hoje, por hora. Concluir pede a confirmação à tela (a mesma do Sprint). */
defineProps<{ tasks: HomeTask[]; busy?: boolean }>()
const emit = defineEmits<{ complete: [task: HomeTask] }>()
</script>

<template>
  <BaseCard title="Tarefas de hoje" data-testid="home-tasks">
    <p v-if="!tasks.length" class="text-muted-foreground text-sm" data-testid="tasks-empty">
      Nenhuma tarefa planejada para hoje.
    </p>

    <ul v-else class="divide-border flex flex-col divide-y">
      <li v-for="task in tasks" :key="task.id" class="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0" data-testid="task-item">
        <span class="text-muted-foreground w-11 shrink-0 text-sm tabular-nums" data-testid="task-time">
          {{ task.time ?? 'Dia' }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium wrap-break-word" :class="task.done && 'text-muted-foreground line-through'">
            {{ task.title }}
          </p>
          <p class="mt-1 flex flex-wrap items-center gap-1.5">
            <span v-if="task.estimateMinutes" class="text-muted-foreground text-xs">{{ formatMinutes(task.estimateMinutes) }}</span>
            <BaseBadge v-if="!task.inSprint" data-testid="task-not-in-sprint">Fora do sprint: não pontua</BaseBadge>
            <BaseBadge v-if="task.done && !task.overdue" tone="success" data-testid="task-done">
              <CircleCheck class="size-3" aria-hidden="true" />
              Concluída<template v-if="task.inSprint && fullPoints(task) !== null"> · {{ fullPoints(task) }} pts</template>
            </BaseBadge>
            <BaseBadge v-else-if="task.done" tone="warning" data-testid="task-done-late">
              <Clock class="size-3" aria-hidden="true" />
              Concluída com atraso<template v-if="task.inSprint && latePoints(task) !== null"> · {{ latePoints(task) }} pts (20%)</template>
            </BaseBadge>
            <BaseBadge v-else-if="task.overdue" tone="danger" data-testid="task-overdue">
              <Clock class="size-3" aria-hidden="true" />
              Atrasada<template v-if="task.inSprint">: concluir agora vale 20%</template>
            </BaseBadge>
          </p>
        </div>
        <BaseButton
          v-if="!task.done"
          size="sm"
          variant="outline"
          :disabled="busy"
          :aria-label="`Concluir ${task.title}`"
          @click="emit('complete', task)"
        >
          Concluir
        </BaseButton>
      </li>
    </ul>
  </BaseCard>
</template>
