<script setup lang="ts">
import {
  ArrowRightLeft,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from '@lucide/vue'
import { computed, ref, useId } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseProgressBar from '@/components/common/BaseProgressBar.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import TaskItem from '@/components/features/TaskItem.vue'
import type { SuperTask } from '@/types/superTask'
import { SUPER_TASK_REASON, SUPER_TASK_STATE_LABEL } from '@/types/superTask'
import type { Task } from '@/types/task'
import { formatDate } from '@/utils/dateFormatter'

const props = defineProps<{
  superTask: SuperTask
  /** Tarefas avulsas da mesma área que podem entrar como filhas (abertas e não arquivadas). */
  candidates: Task[]
  busy?: boolean
}>()

const emit = defineEmits<{
  edit: []
  move: []
  remove: []
  complete: []
  reopen: []
  addChild: [title: string]
  addTask: [taskId: string]
  taskEdit: [task: Task]
  taskArchive: [task: Task]
  taskUnarchive: [task: Task]
  taskComplete: [task: Task]
  taskRemove: [task: Task]
  taskUnlink: [task: Task]
}>()

const id = useId()
const panelId = `${id}-panel`
const expanded = ref(false)
const draft = ref('')
const selectedTaskId = ref<string | null>(null)

const locked = computed(() => props.superTask.done)

/** Por que "mover" está desabilitado (espelha as recusas 409 do backend); `null` = disponível. */
const moveReason = computed(() => {
  if (locked.value) return SUPER_TASK_REASON.locked
  if (props.superTask.tasks.some((task) => task.done)) return SUPER_TASK_REASON.moveWithDone
  if (props.superTask.tasks.some((task) => task.sprintId)) return SUPER_TASK_REASON.moveWithSprint
  return null
})

/** Por que "marcar como concluída" está desabilitado; `null` = disponível (só em 100%). */
const completeReason = computed(() => {
  if (props.superTask.canComplete) return null
  // Filha arquivada e ainda aberta segura o 100%: o backend só conclui sem ela.
  if (props.superTask.tasks.some((task) => task.archived && !task.done)) return SUPER_TASK_REASON.completeArchived
  return SUPER_TASK_REASON.completeIncomplete
})

const stateTone = computed(() => (locked.value ? 'success' : props.superTask.state === 'EM_ANDAMENTO' ? 'info' : 'neutral'))

function submitChild(): void {
  const title = draft.value.trim()
  if (!title) return
  emit('addChild', title)
  draft.value = ''
}

function submitTask(): void {
  if (!selectedTaskId.value) return
  emit('addTask', selectedTaskId.value)
  selectedTaskId.value = null
}
</script>

<template>
  <li
    class="border-border border-t"
    :class="superTask.overdue && 'bg-danger-soft/30'"
    :data-testid="`super-task-${superTask.id}`"
  >
    <div class="flex flex-col gap-2 px-4 py-3">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="focus-visible:outline-ring flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2"
          :aria-expanded="expanded"
          :aria-controls="panelId"
          data-testid="toggle-super-task"
          @click="expanded = !expanded"
        >
          <ChevronDown
            class="text-muted-foreground size-4 shrink-0 transition-transform motion-reduce:transition-none"
            :class="!expanded && '-rotate-90'"
            aria-hidden="true"
          />
          <Lock v-if="locked" class="text-success size-4 shrink-0" aria-label="Travada" />
          <span class="truncate font-medium" :class="locked && 'text-muted-foreground'">{{ superTask.title }}</span>
        </button>

        <BaseBadge :tone="stateTone" data-testid="super-task-state">{{ SUPER_TASK_STATE_LABEL[superTask.state] }}</BaseBadge>
      </div>

      <div class="flex flex-wrap items-center gap-1.5 pl-6">
        <BaseBadge v-if="superTask.endDate" :tone="superTask.overdue ? 'danger' : 'neutral'" data-testid="super-task-end-date">
          <CalendarClock class="size-3" aria-hidden="true" />
          Término {{ formatDate(superTask.endDate) }}
          <template v-if="superTask.overdue"> · Vencida</template>
        </BaseBadge>
        <BaseBadge v-if="superTask.archived" tone="info">Arquivada</BaseBadge>
      </div>

      <div class="flex flex-col gap-1 pl-6">
        <BaseProgressBar
          :value="superTask.progress"
          :label="`Progresso de ${superTask.title}`"
          :tone="locked ? 'success' : 'primary'"
        />
        <p class="text-muted-foreground text-xs tabular-nums" data-testid="super-task-progress-text">
          {{ superTask.progress }}% · {{ superTask.completedTasks }} de {{ superTask.totalTasks }}
        </p>
      </div>
    </div>

    <div v-show="expanded" :id="panelId" class="border-border bg-background/40 border-t" role="region" :aria-label="`Detalhes de ${superTask.title}`">
      <div class="flex flex-wrap items-center gap-1 px-4 py-2">
        <BaseButton
          v-if="!locked"
          variant="ghost"
          size="sm"
          class="hover:text-success"
          :disabled="Boolean(completeReason) || busy"
          data-testid="complete-super-task"
          @click="emit('complete')"
        >
          <CircleCheck class="size-4" aria-hidden="true" />
          Marcar como concluída
        </BaseButton>
        <BaseButton v-else variant="ghost" size="sm" :disabled="busy" data-testid="reopen-super-task" @click="emit('reopen')">
          <RotateCcw class="size-4" aria-hidden="true" />
          Desmarcar conclusão
        </BaseButton>
        <BaseButton
          variant="ghost"
          size="sm"
          :disabled="locked || busy"
          :aria-label="`Editar ${superTask.title}`"
          data-testid="edit-super-task"
          @click="emit('edit')"
        >
          <Pencil class="size-4" aria-hidden="true" />
          Editar
        </BaseButton>
        <BaseButton
          variant="ghost"
          size="sm"
          :disabled="Boolean(moveReason) || busy"
          :aria-label="`Mover ${superTask.title}`"
          data-testid="move-super-task"
          @click="emit('move')"
        >
          <ArrowRightLeft class="size-4" aria-hidden="true" />
          Mover
        </BaseButton>
        <BaseButton
          variant="ghost"
          size="sm"
          class="hover:text-danger"
          :disabled="busy"
          :aria-label="`Excluir ${superTask.title}`"
          data-testid="delete-super-task"
          @click="emit('remove')"
        >
          <Trash2 class="size-4" aria-hidden="true" />
          Excluir
        </BaseButton>
      </div>

      <!-- Motivos visíveis (e lidos por leitores de tela) das ações desabilitadas. -->
      <ul class="text-muted-foreground flex flex-col gap-0.5 px-4 pb-2 text-xs" data-testid="super-task-reasons">
        <li v-if="locked">{{ SUPER_TASK_REASON.locked }}</li>
        <li v-else-if="completeReason">{{ completeReason }}</li>
        <li v-if="!locked && moveReason">{{ moveReason }}</li>
      </ul>

      <ul v-if="superTask.tasks.length" class="border-border border-t" :aria-label="`Tarefas de ${superTask.title}`">
        <TaskItem
          v-for="task in superTask.tasks"
          :key="task.id"
          :task="task"
          in-super-task
          @edit="emit('taskEdit', task)"
          @archive="emit('taskArchive', task)"
          @unarchive="emit('taskUnarchive', task)"
          @complete="emit('taskComplete', task)"
          @remove="emit('taskRemove', task)"
          @unlink="emit('taskUnlink', task)"
        />
      </ul>
      <p v-else class="text-muted-foreground border-border border-t px-4 py-3 text-sm">
        Nenhuma tarefa nesta Super task ainda.
      </p>

      <div v-if="!locked" class="border-border flex flex-col gap-3 border-t px-4 py-3">
        <form class="flex items-center gap-2" novalidate @submit.prevent="submitChild">
          <BaseInput
            v-model="draft"
            class="flex-1"
            :aria-label="`Nova tarefa em ${superTask.title}`"
            placeholder="Adicionar tarefa à Super task (só o título)"
            :maxlength="200"
            autocomplete="off"
          />
          <BaseButton type="submit" variant="outline" :disabled="busy">
            <Plus class="size-4" aria-hidden="true" />
            Adicionar
          </BaseButton>
        </form>

        <form v-if="candidates.length" class="flex items-end gap-2" novalidate @submit.prevent="submitTask">
          <BaseSelect
            v-model="selectedTaskId"
            class="flex-1"
            label="Colocar tarefa avulsa"
            placeholder="Escolha uma tarefa da área"
            :options="candidates.map((task) => ({ label: task.title, value: task.id }))"
          />
          <BaseButton type="submit" variant="outline" :disabled="!selectedTaskId || busy" data-testid="add-existing-task">
            Colocar
          </BaseButton>
        </form>
      </div>
    </div>
  </li>
</template>
