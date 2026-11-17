<script setup lang="ts">
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  CalendarPlus,
  CircleCheck,
  Layers,
  Pencil,
  Trash2,
  TriangleAlert,
  Unlink,
} from '@lucide/vue'
import { computed } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import TaskDeadlineBadge from '@/components/features/TaskDeadlineBadge.vue'
import { SUPER_TASK_REASON } from '@/types/superTask'
import type { Task } from '@/types/task'
import { missingSprintFields, TASK_DIFFICULTIES, TASK_ESTIMATES, TASK_PRIORITIES } from '@/types/task'
import { formatDate } from '@/utils/dateFormatter'
import { buildGoogleCalendarUrl } from '@/utils/googleCalendar'

const props = defineProps<{
  task: Task
  /** Filha dentro de um bloco de Super task: não muda de área sozinha e ganha "retirar". */
  inSuperTask?: boolean
}>()

const emit = defineEmits<{
  edit: []
  move: []
  archive: []
  unarchive: []
  complete: []
  remove: []
  convert: []
  unlink: []
}>()

/** Link da Google Agenda; `null` (sem botão) se a tarefa não tem dia e hora. */
const calendarUrl = computed(() => buildGoogleCalendarUrl(props.task))

/** Por que "virar Super task" está desabilitado; `null` = disponível. */
const convertReason = computed(() => {
  if (props.task.done) return SUPER_TASK_REASON.convertDone
  if (props.task.sprintId) return SUPER_TASK_REASON.convertInSprint
  return null
})

/** Por que "retirar da Super task" está desabilitado; `null` = disponível. */
const unlinkReason = computed(() => (props.task.done ? SUPER_TASK_REASON.childDone : null))

const missing = computed(() => missingSprintFields(props.task))

function labelOf<V>(options: readonly { value: V; label: string }[], value: V | null): string | null {
  return options.find((option) => option.value === value)?.label ?? null
}

const estimate = computed(() => labelOf(TASK_ESTIMATES, props.task.estimateMinutes))
const difficulty = computed(() => labelOf(TASK_DIFFICULTIES, props.task.difficulty))
const priority = computed(() => labelOf(TASK_PRIORITIES, props.task.priority))
</script>

<template>
  <li
    class="border-border flex flex-col gap-2 border-t px-4 py-3 first:border-t-0 sm:flex-row sm:items-center"
    :data-testid="`task-${task.id}`"
  >
    <div class="min-w-0 flex-1">
      <p
        class="truncate font-medium"
        :class="task.archived ? 'text-muted-foreground line-through' : task.done && 'text-muted-foreground'"
      >
        {{ task.title }}
      </p>
      <div class="mt-1 flex flex-wrap items-center gap-1.5">
        <BaseBadge v-if="task.day">{{ formatDate(task.day) }}{{ task.time ? ` às ${task.time}` : '' }}</BaseBadge>
        <BaseBadge v-if="estimate">{{ estimate }}</BaseBadge>
        <BaseBadge v-if="difficulty">{{ difficulty }}</BaseBadge>
        <BaseBadge v-if="priority" :tone="task.priority === 'ALTA' ? 'danger' : 'neutral'">
          Prioridade {{ priority.toLowerCase() }}
        </BaseBadge>
        <BaseBadge v-if="task.archived" tone="info">Arquivada</BaseBadge>
        <TaskDeadlineBadge v-if="!task.archived" :task="task" />
        <span
          v-if="missing.length && !task.archived"
          class="bg-warning-soft text-warning inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          :title="`Faltam para entrar no sprint: ${missing.join(', ')}`"
          data-testid="sprint-warning"
        >
          <TriangleAlert class="size-3" aria-hidden="true" />
          Faltam: {{ missing.join(', ') }}
        </span>
      </div>
    </div>

    <!-- Ações de Super task: ficam visíveis, desabilitadas e explicadas, mesmo em tarefa concluída. -->
    <div v-if="!task.archived" class="flex gap-1">
      <template v-if="inSuperTask">
        <BaseButton
          variant="ghost"
          size="icon"
          :aria-label="`Retirar ${task.title} da Super task`"
          :title="unlinkReason ?? 'Retirar da Super task'"
          :disabled="Boolean(unlinkReason)"
          :aria-describedby="unlinkReason ? `unlink-reason-${task.id}` : undefined"
          data-testid="unlink-task"
          @click="emit('unlink')"
        >
          <Unlink class="size-4" aria-hidden="true" />
        </BaseButton>
        <span v-if="unlinkReason" :id="`unlink-reason-${task.id}`" class="sr-only">{{ unlinkReason }}</span>
      </template>
      <template v-else>
        <BaseButton
          variant="ghost"
          size="icon"
          :aria-label="`Transformar ${task.title} em Super task`"
          :title="convertReason ?? 'Transformar em Super task'"
          :disabled="Boolean(convertReason)"
          :aria-describedby="convertReason ? `convert-reason-${task.id}` : undefined"
          data-testid="convert-task"
          @click="emit('convert')"
        >
          <Layers class="size-4" aria-hidden="true" />
        </BaseButton>
        <span v-if="convertReason" :id="`convert-reason-${task.id}`" class="sr-only">{{ convertReason }}</span>
      </template>
    </div>

    <!-- Tarefa concluída é só leitura: a conclusão é definitiva, sem ações. -->
    <div v-if="!task.done" class="flex gap-1">
      <template v-if="!task.archived">
        <BaseButton
          variant="ghost"
          size="icon"
          class="hover:text-success"
          :aria-label="`Concluir ${task.title}`"
          data-testid="complete-task"
          @click="emit('complete')"
        >
          <CircleCheck class="size-4" aria-hidden="true" />
        </BaseButton>
        <a
          v-if="calendarUrl"
          :href="calendarUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-muted-foreground hover:bg-success/25 hover:text-foreground focus-visible:outline-ring inline-flex h-9 w-9 items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          :aria-label="`Adicionar ${task.title} à Google Agenda (abre em nova aba)`"
          title="Adicionar à Google Agenda"
          data-testid="add-to-calendar"
        >
          <CalendarPlus class="size-4" aria-hidden="true" />
        </a>
        <BaseButton variant="ghost" size="icon" :aria-label="`Editar ${task.title}`" @click="emit('edit')">
          <Pencil class="size-4" aria-hidden="true" />
        </BaseButton>
        <BaseButton
          variant="ghost"
          size="icon"
          :aria-label="`Mover ${task.title}`"
          :title="inSuperTask ? SUPER_TASK_REASON.childMove : undefined"
          :disabled="inSuperTask"
          data-testid="move-task"
          @click="emit('move')"
        >
          <ArrowRightLeft class="size-4" aria-hidden="true" />
        </BaseButton>
        <BaseButton variant="ghost" size="icon" :aria-label="`Arquivar ${task.title}`" @click="emit('archive')">
          <Archive class="size-4" aria-hidden="true" />
        </BaseButton>
      </template>
      <BaseButton
        v-else
        variant="ghost"
        size="icon"
        :aria-label="`Desarquivar ${task.title}`"
        @click="emit('unarchive')"
      >
        <ArchiveRestore class="size-4" aria-hidden="true" />
      </BaseButton>
      <BaseButton
        variant="ghost"
        size="icon"
        class="hover:text-danger"
        :aria-label="`Excluir ${task.title}`"
        @click="emit('remove')"
      >
        <Trash2 class="size-4" aria-hidden="true" />
      </BaseButton>
    </div>
  </li>
</template>
