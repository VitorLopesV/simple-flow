<script setup lang="ts">
import { Archive, ArchiveRestore, ArrowRightLeft, Pencil, Trash2, TriangleAlert } from '@lucide/vue'
import { computed } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import type { Task } from '@/types/task'
import { missingSprintFields, TASK_DIFFICULTIES, TASK_ESTIMATES, TASK_PRIORITIES } from '@/types/task'
import { formatDate } from '@/utils/dateFormatter'

const props = defineProps<{ task: Task }>()

const emit = defineEmits<{
  edit: []
  move: []
  archive: []
  unarchive: []
  remove: []
}>()

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
      <p class="truncate font-medium" :class="task.archived && 'text-muted-foreground line-through'">
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

    <div class="flex gap-1">
      <template v-if="!task.archived">
        <BaseButton variant="ghost" size="icon" :aria-label="`Editar ${task.title}`" @click="emit('edit')">
          <Pencil class="size-4" aria-hidden="true" />
        </BaseButton>
        <BaseButton variant="ghost" size="icon" :aria-label="`Mover ${task.title}`" @click="emit('move')">
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
