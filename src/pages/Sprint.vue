<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import BaseToggleGroup from '@/components/common/BaseToggleGroup.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import SprintAddTaskModal from '@/components/features/SprintAddTaskModal.vue'
import SprintDayColumn from '@/components/features/SprintDayColumn.vue'
import SprintMoveDialog from '@/components/features/SprintMoveDialog.vue'
import SprintScoreboard from '@/components/features/SprintScoreboard.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notify } from '@/composables/useNotify'
import { useAreaStore } from '@/stores/areaStore'
import { useSprintStore } from '@/stores/sprintStore'
import { useTaskStore } from '@/stores/taskStore'
import type { SprintWhich } from '@/types/sprint'
import { SPRINT_WHICH_OPTIONS } from '@/types/sprint'
import type { Task } from '@/types/task'
import { formatDate } from '@/utils/dateFormatter'

const store = useSprintStore()
const areaStore = useAreaStore()
const taskStore = useTaskStore()

const addOpen = ref(false)
const addDay = ref<string | null>(null)
const moveOpen = ref(false)
const toMove = ref<Task | null>(null)
const removeOpen = ref(false)
const toRemove = ref<Task | null>(null)
/** Dia mostrado no celular (abas); em telas largas todos os dias aparecem. */
const activeDay = ref<string | null>(null)

onMounted(async () => {
  await store.load()
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
      <BaseToggleGroup
        :model-value="store.which"
        :options="[...SPRINT_WHICH_OPTIONS]"
        label="Sprint exibido"
        @update:model-value="(value: SprintWhich) => store.select(value)"
      />
      <BaseButton variant="success" class="!h-11" :disabled="!store.view" @click="openAdd(null)">
        <Plus class="size-4" aria-hidden="true" />
        Adicionar tarefa
      </BaseButton>
    </template>

    <p v-if="period" class="text-muted-foreground -mt-3 text-sm" data-testid="sprint-period">
      {{ store.which === 'current' ? 'Sprint atual' : 'Próximo sprint' }} · {{ period }}
    </p>

    <div v-if="store.loading && !store.view" class="bg-card border-border rounded-card border p-4">
      <BaseSkeleton :lines="3" height="h-6" />
    </div>

    <template v-else-if="store.view && store.scoreboard">
      <SprintScoreboard :scoreboard="store.scoreboard.scoreboard" :preview="store.isPreview" />

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
          :class="activeDay === column.date ? '' : 'hidden lg:flex'"
          @add="openAdd(column.date)"
          @move="askMove"
          @remove="askRemove"
        />
      </div>
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
