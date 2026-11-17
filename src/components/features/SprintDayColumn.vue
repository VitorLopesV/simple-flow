<script setup lang="ts">
import { ArrowRightLeft, Check, CircleCheck, Clock, Lock, Plus, Repeat, Undo2 } from '@lucide/vue'
import { computed } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import TaskDeadlineBadge from '@/components/features/TaskDeadlineBadge.vue'
import type { SprintColumn } from '@/stores/sprintStore'
import type { RoutineOccurrence } from '@/types/sprint'
import type { Task } from '@/types/task'
import { TASK_DIFFICULTIES, TASK_PRIORITIES } from '@/types/task'
import { formatDate } from '@/utils/dateFormatter'
import { formatMinutes } from '@/utils/sprint'

const props = defineProps<{ column: SprintColumn; busy?: boolean }>()

const emit = defineEmits<{
  add: []
  move: [task: Task]
  remove: [task: Task]
  completeTask: [task: Task]
  completeOccurrence: [occurrence: RoutineOccurrence]
}>()

const headingId = computed(() => `sprint-day-${props.column.date}`)

function labelOf<V>(options: readonly { value: V; label: string }[], value: V | null): string | null {
  return options.find((option) => option.value === value)?.label ?? null
}
</script>

<template>
  <section
    class="bg-card border-border rounded-card flex min-w-0 flex-col gap-3 border p-3"
    :class="[column.locked && 'opacity-90', column.isToday && 'border-primary']"
    :aria-labelledby="headingId"
    :data-testid="`day-${column.date}`"
  >
    <header class="flex flex-col gap-1">
      <div class="flex items-center justify-between gap-2">
        <h2 :id="headingId" class="font-semibold">
          {{ column.label }}
          <span class="text-muted-foreground text-sm font-normal">{{ formatDate(column.date).slice(0, 5) }}</span>
        </h2>
        <BaseBadge v-if="column.isToday" tone="info">Hoje</BaseBadge>
        <BaseBadge v-else-if="column.locked" tone="neutral" data-testid="locked-badge">
          <Lock class="size-3" aria-hidden="true" />
          Encerrado
        </BaseBadge>
      </div>
      <p class="text-muted-foreground flex items-center gap-1 text-xs" data-testid="day-total">
        <Clock class="size-3" aria-hidden="true" />
        {{ formatMinutes(column.totalMinutes) }} estimados
      </p>
      <p v-if="column.locked" class="text-muted-foreground text-xs" data-testid="locked-note">
        Dia que já passou: somente leitura. Só dá para concluir.
      </p>
    </header>

    <div>
      <h3 class="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Missão do dia</h3>
      <ul v-if="column.occurrences.length" class="flex flex-col gap-1" aria-label="Missão do dia">
        <li
          v-for="occurrence in column.occurrences"
          :key="occurrence.id ?? `${occurrence.itemId}-${occurrence.index}`"
          class="bg-muted/40 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
        >
          <Check v-if="occurrence.completedAt" class="text-success size-4 shrink-0" aria-label="Concluída" />
          <Repeat v-else class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate" :class="occurrence.completedAt && 'line-through'">
            {{ occurrence.name }}
          </span>
          <span v-if="occurrence.time" class="text-muted-foreground text-xs tabular-nums">{{ occurrence.time }}</span>
          <!-- O checklist só vale para hoje: outros dias (e a prévia, sem ocorrência gravada) ficam desabilitados. -->
          <BaseButton
            v-if="!occurrence.completedAt"
            variant="ghost"
            size="icon"
            class="hover:text-success"
            :disabled="busy || !column.isToday || !occurrence.id"
            :aria-label="`Concluir ${occurrence.name}`"
            :title="column.isToday && occurrence.id ? 'Concluir' : 'A rotina só pode ser concluída no próprio dia'"
            data-testid="complete-occurrence"
            @click="emit('completeOccurrence', occurrence)"
          >
            <CircleCheck class="size-4" aria-hidden="true" />
          </BaseButton>
        </li>
      </ul>
      <p v-else class="text-muted-foreground text-sm">Sem rotina neste dia.</p>
    </div>

    <div class="flex flex-1 flex-col">
      <h3 class="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Tarefas</h3>
      <ul v-if="column.tasks.length" class="flex flex-col gap-2" aria-label="Tarefas do dia">
        <li
          v-for="task in column.tasks"
          :key="task.id"
          class="border-border flex flex-col gap-1.5 rounded-lg border p-2"
          :data-testid="`sprint-task-${task.id}`"
        >
          <div class="flex items-start gap-2">
            <Check v-if="task.done" class="text-success mt-0.5 size-4 shrink-0" aria-label="Concluída" />
            <p class="min-w-0 flex-1 text-sm font-medium" :class="task.done && 'text-muted-foreground line-through'">
              {{ task.title }}
            </p>
            <span v-if="task.time" class="text-muted-foreground text-xs tabular-nums">{{ task.time }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-1">
            <TaskDeadlineBadge :task="task" />
            <BaseBadge v-if="task.superTaskName" tone="info" data-testid="super-task-badge">
              Super task: {{ task.superTaskName }}
            </BaseBadge>
            <BaseBadge v-if="task.estimateMinutes">{{ formatMinutes(task.estimateMinutes) }}</BaseBadge>
            <BaseBadge v-if="task.difficulty">{{ labelOf(TASK_DIFFICULTIES, task.difficulty) }}</BaseBadge>
            <BaseBadge v-if="task.priority" :tone="task.priority === 'ALTA' ? 'danger' : 'neutral'">
              {{ labelOf(TASK_PRIORITIES, task.priority) }}
            </BaseBadge>
          </div>
          <!-- Concluída é só leitura. Em dia que já passou só dá para concluir (sem mover nem remover). -->
          <div v-if="!task.done" class="flex justify-end gap-1">
            <BaseButton
              variant="ghost"
              size="icon"
              class="hover:text-success"
              :disabled="busy"
              :aria-label="`Concluir ${task.title}`"
              data-testid="complete-task"
              @click="emit('completeTask', task)"
            >
              <CircleCheck class="size-4" aria-hidden="true" />
            </BaseButton>
            <template v-if="!column.locked">
              <BaseButton
                variant="ghost"
                size="icon"
                :disabled="busy"
                :aria-label="`Mover ${task.title} para outro dia`"
                @click="emit('move', task)"
              >
                <ArrowRightLeft class="size-4" aria-hidden="true" />
              </BaseButton>
              <BaseButton
                variant="ghost"
                size="icon"
                class="hover:text-danger"
                :disabled="busy"
                :aria-label="`Remover ${task.title} do sprint`"
                @click="emit('remove', task)"
              >
                <Undo2 class="size-4" aria-hidden="true" />
              </BaseButton>
            </template>
          </div>
        </li>
      </ul>
      <p v-else class="text-muted-foreground text-sm">Nenhuma tarefa neste dia.</p>
    </div>

    <BaseButton v-if="!column.locked" variant="outline" size="sm" :disabled="busy" @click="emit('add')">
      <Plus class="size-4" aria-hidden="true" />
      Adicionar tarefa
      <span class="sr-only">em {{ column.label }}</span>
    </BaseButton>
  </section>
</template>
