<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import BaseToggleGroup from '@/components/common/BaseToggleGroup.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import CompleteConfirmDialog from '@/components/features/CompleteConfirmDialog.vue'
import PlanningReminder from '@/components/features/PlanningReminder.vue'
import SprintAddTaskModal from '@/components/features/SprintAddTaskModal.vue'
import SprintHistory from '@/components/features/SprintHistory.vue'
import SprintDayColumn from '@/components/features/SprintDayColumn.vue'
import SprintMoveDialog from '@/components/features/SprintMoveDialog.vue'
import SprintRewardCard from '@/components/features/SprintRewardCard.vue'
import SprintScoreboard from '@/components/features/SprintScoreboard.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notify } from '@/composables/useNotify'
import { useAreaStore } from '@/stores/areaStore'
import { useSprintStore } from '@/stores/sprintStore'
import { useSuperTaskStore } from '@/stores/superTaskStore'
import { useTaskStore } from '@/stores/taskStore'
import type { RoutineOccurrence, SprintWhich } from '@/types/sprint'
import { SPRINT_WHICH_OPTIONS } from '@/types/sprint'
import type { Task } from '@/types/task'
import { formatDate } from '@/utils/dateFormatter'
import { fullPoints, latePoints, wouldBeLate } from '@/utils/taskCompletion'

const store = useSprintStore()
const areaStore = useAreaStore()
const taskStore = useTaskStore()
const superTaskStore = useSuperTaskStore()

/** Seção exibida: a semana (atual/próximo) ou o histórico dos sprints fechados. */
const section = ref<'week' | 'history'>('week')
const SECTION_OPTIONS = [
  { value: 'week' as const, label: 'Semana' },
  { value: 'history' as const, label: 'Histórico' },
]

const addOpen = ref(false)
const addDay = ref<string | null>(null)
const moveOpen = ref(false)
const toMove = ref<Task | null>(null)
const completeOpen = ref(false)
const taskToComplete = ref<Task | null>(null)
const occurrenceToComplete = ref<RoutineOccurrence | null>(null)
const removeOpen = ref(false)
const toRemove = ref<Task | null>(null)
/** Dia mostrado no celular (abas); em telas largas todos os dias aparecem. */
const activeDay = ref<string | null>(null)

onMounted(async () => {
  // As Super tasks só dão o nome da etiqueta nas filhas do sprint.
  await Promise.all([store.load(), superTaskStore.load()])
})

watch(
  () => store.error,
  (error) => error && notify.error(error),
)

/** Ao carregar ou trocar de sprint, a aba ativa vira hoje (ou o primeiro dia). */
watch(
  () => store.columns,
  (columns) => {
    if (columns.some((column) => column.date === activeDay.value)) return
    activeDay.value = (columns.find((column) => column.isToday) ?? columns[0])?.date ?? null
  },
)

const period = computed(() => {
  const view = store.view
  return view ? `${formatDate(view.sprint.startDate)} a ${formatDate(view.sprint.endDate)}` : ''
})

async function openAdd(day: string | null): Promise<void> {
  addDay.value = day
  addOpen.value = true
  // O backlog e as áreas só são necessários aqui: carregam ao abrir o modal.
  await Promise.all([areaStore.load(), taskStore.load()])
}

async function add(taskId: string, day: string): Promise<void> {
  if (await store.addTask(taskId, day)) {
    notify.success('Tarefa adicionada ao sprint')
    await taskStore.load()
  }
}

function askMove(task: Task): void {
  toMove.value = task
  moveOpen.value = true
}

async function confirmMove(day: string): Promise<void> {
  const task = toMove.value
  if (!task) return
  if (await store.moveTask(task.id, day)) {
    notify.success('Tarefa movida', task.title)
    moveOpen.value = false
    toMove.value = null
  }
}

function askCompleteTask(task: Task): void {
  taskToComplete.value = task
  occurrenceToComplete.value = null
  completeOpen.value = true
}

function askCompleteOccurrence(occurrence: RoutineOccurrence): void {
  occurrenceToComplete.value = occurrence
  taskToComplete.value = null
  completeOpen.value = true
}

/** Conclui o que foi confirmado; o store recarrega sprint e placar, que atualizam na hora. */
async function confirmComplete(): Promise<void> {
  const task = taskToComplete.value
  const occurrence = occurrenceToComplete.value
  if (task) {
    if (!(await store.completeTask(task.id))) return
    notify.success('Tarefa concluída', task.title)
  } else if (occurrence?.id) {
    if (!(await store.completeOccurrence(occurrence.id))) return
    notify.success('Rotina concluída', occurrence.name)
  } else {
    return
  }
  completeOpen.value = false
  taskToComplete.value = null
  occurrenceToComplete.value = null
}

async function saveReward(reward: string | null): Promise<void> {
  if (await store.setReward(reward)) notify.success(reward ? 'Recompensa salva' : 'Recompensa removida')
}

async function saveDefaultReward(reward: string | null): Promise<void> {
  if (await store.setDefaultReward(reward)) notify.success(reward ? 'Recompensa padrão salva' : 'Recompensa padrão removida')
}

function askRemove(task: Task): void {
  toRemove.value = task
  removeOpen.value = true
}

async function confirmRemove(): Promise<void> {
  const task = toRemove.value
  if (!task) return
  if (await store.removeTask(task.id)) {
    notify.success('Tarefa devolvida ao backlog', task.title)
    removeOpen.value = false
    toRemove.value = null
  }
}
</script>

<template>
  <PageLayout title="Sprint" description="Planeje e acompanhe a semana, de segunda a sexta">
    <template #actions>
      <BaseToggleGroup v-model="section" :options="SECTION_OPTIONS" label="Seção do sprint" />
      <BaseToggleGroup
        v-if="section === 'week'"
        :model-value="store.which"
        :options="[...SPRINT_WHICH_OPTIONS]"
        label="Sprint exibido"
        @update:model-value="(value: SprintWhich) => store.select(value)"
      />
      <BaseButton v-if="section === 'week'" variant="success" class="!h-11" :disabled="!store.view || store.isClosed" @click="openAdd(null)">
        <Plus class="size-4" aria-hidden="true" />
        Adicionar tarefa
      </BaseButton>
    </template>

    <SprintHistory v-if="section === 'history'" />

    <template v-if="section === 'week'">
    <p v-if="period" class="text-muted-foreground -mt-3 text-sm" data-testid="sprint-period">
      {{ store.which === 'current' ? 'Sprint atual' : 'Próximo sprint' }} · {{ period }}
    </p>

    <!-- Domingo (America/Sao_Paulo): convida a planejar; no próprio "próximo" não precisa do botão. -->
    <PlanningReminder>
      <template v-if="store.which === 'current'" #actions>
        <BaseButton size="sm" data-testid="go-next" @click="store.select('next')">Ver o próximo sprint</BaseButton>
      </template>
    </PlanningReminder>

    <div v-if="store.loading && !store.view" class="bg-card border-border rounded-card border p-4">
      <BaseSkeleton :lines="3" height="h-6" />
    </div>

    <template v-else-if="store.view && store.scoreboard">
      <!-- Sprint fechado (sáb/dom): o placar é a foto do fechamento e o planejamento é do próximo. -->
      <div
        v-if="store.isClosed"
        class="bg-muted rounded-card flex flex-wrap items-center gap-3 p-4 text-sm"
        role="status"
        data-testid="closed-notice"
      >
        <p class="min-w-0 flex-1">Este sprint já foi encerrado. O planejamento da semana é feito no próximo sprint.</p>
        <BaseButton v-if="store.which === 'current'" size="sm" variant="outline" @click="store.select('next')">
          Planejar o próximo
        </BaseButton>
      </div>

      <SprintScoreboard
        :scoreboard="store.scoreboard.scoreboard"
        :preview="store.isPreview"
        :closed="store.scoreboard.closed"
        :reward="store.scoreboard.reward"
      />

      <SprintRewardCard
        v-if="store.which === 'next'"
        :reward="store.view.sprint.reward"
        :default-reward="store.view.defaultReward"
        :effective-reward="store.view.effectiveReward"
        :closed="store.isClosed"
        :saving="store.saving"
        @save-reward="saveReward"
        @save-default="saveDefaultReward"
      />

      <!-- Celular: abas, um dia por vez -->
      <div class="flex gap-1 overflow-x-auto lg:hidden" role="tablist" aria-label="Dias do sprint">
        <button
          v-for="column in store.columns"
          :id="`tab-${column.date}`"
          :key="column.date"
          type="button"
          role="tab"
          class="focus-visible:outline-ring rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-2"
          :class="activeDay === column.date ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          :aria-selected="activeDay === column.date"
          :aria-controls="`sprint-day-${column.date}`"
          :data-testid="`tab-${column.date}`"
          @click="activeDay = column.date"
        >
          {{ column.short }} {{ formatDate(column.date).slice(0, 5) }}
        </button>
      </div>

      <div class="grid grid-cols-1 gap-3 lg:grid-cols-5" data-testid="sprint-columns">
        <SprintDayColumn
          v-for="column in store.columns"
          :key="column.date"
          :column="column"
          :busy="store.saving"
          :super-task-names="superTaskStore.namesById"
          :class="activeDay === column.date ? '' : 'hidden lg:flex'"
          @add="openAdd(column.date)"
          @move="askMove"
          @remove="askRemove"
          @complete-task="askCompleteTask"
          @complete-occurrence="askCompleteOccurrence"
        />
      </div>
    </template>
    </template>

    <SprintAddTaskModal
      v-model:open="addOpen"
      :areas="areaStore.areas"
      :tasks="taskStore.tasks"
      :days="store.openDays"
      :initial-day="addDay"
      :saving="store.saving"
      @add="add"
    />

    <SprintMoveDialog
      v-model:open="moveOpen"
      :task="toMove"
      :days="store.columns"
      :loading="store.saving"
      @confirm="confirmMove"
    />

    <CompleteConfirmDialog
      v-model:open="completeOpen"
      :kind="occurrenceToComplete ? 'routine' : 'task'"
      :name="taskToComplete?.title ?? occurrenceToComplete?.name ?? ''"
      :overdue="taskToComplete ? wouldBeLate(taskToComplete) : false"
      :points="taskToComplete ? fullPoints(taskToComplete) : null"
      :reduced-points="taskToComplete ? latePoints(taskToComplete) : null"
      :loading="store.saving"
      @confirm="confirmComplete"
    />

    <ConfirmDialog
      v-model:open="removeOpen"
      title="Remover do sprint"
      :message="`Remover ${toRemove?.title ?? ''} do sprint? Ela volta para o backlog, mantendo o dia.`"
      confirm-text="Remover"
      :loading="store.saving"
      @confirm="confirmRemove"
    />
  </PageLayout>
</template>
