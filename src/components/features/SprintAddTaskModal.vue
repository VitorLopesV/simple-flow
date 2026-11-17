<script setup lang="ts">
import { Plus, TriangleAlert } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import type { Area } from '@/types/area'
import type { SprintColumn } from '@/stores/sprintStore'
import type { Task } from '@/types/task'
import { missingSprintFields, returnedFromSprint, TASK_DIFFICULTIES, TASK_PRIORITIES } from '@/types/task'
import { formatDate } from '@/utils/dateFormatter'
import { formatMinutes } from '@/utils/sprint'

const props = withDefaults(
  defineProps<{
    areas: Area[]
    /** Tarefas do backlog; as que já estão no sprint ou arquivadas são ignoradas aqui. */
    tasks: Task[]
    /** Dias que aceitam tarefas (hoje e futuros). */
    days: SprintColumn[]
    /** Dia pré-selecionado (coluna em que o usuário clicou em "Adicionar"). */
    initialDay?: string | null
    saving?: boolean
  }>(),
  { initialDay: null, saving: false },
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ add: [taskId: string, day: string] }>()

const day = ref<string | null>(null)

watch(
  open,
  (isOpen) => {
    if (isOpen) day.value = props.days.find((item) => item.date === props.initialDay)?.date ?? props.days[0]?.date ?? null
  },
  { immediate: true },
)

/** O dia é escolhido aqui, então não conta como "faltando". */
function missingFields(task: Task): string[] {
  return missingSprintFields(task).filter((field) => field !== 'dia')
}

function labelOf<V>(options: readonly { value: V; label: string }[], value: V | null): string | null {
  return options.find((option) => option.value === value)?.label ?? null
}

/** Áreas comuns (a Rotina não tem tarefas) com as tarefas que ainda estão só no backlog. */
const groups = computed(() =>
  props.areas
    .filter((area) => !area.system)
    .map((area) => ({
      area,
      // As devolvidas pelo sprint anterior vêm primeiro (a ordenação é estável: o resto mantém a ordem).
      tasks: props.tasks
        .filter((task) => task.areaId === area.id && !task.archived && !task.sprintId)
        .sort((a, b) => Number(Boolean(returnedFromSprint(b))) - Number(Boolean(returnedFromSprint(a)))),
    }))
    .filter((group) => group.tasks.length > 0),
)
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Adicionar tarefa ao sprint"
    description="Escolha o dia e a tarefa do backlog. Tarefas sem tempo, dificuldade ou prioridade ainda não entram."
    width="lg"
  >
    <p v-if="!days.length" class="text-muted-foreground text-sm">Não há dias disponíveis neste sprint.</p>
    <div v-else class="flex flex-col gap-4">
      <BaseSelect
        v-model="day"
        label="Dia"
        :options="days.map((item) => ({ label: `${item.label} (${formatDate(item.date).slice(0, 5)})`, value: item.date }))"
      />

      <p v-if="!groups.length" class="text-muted-foreground text-sm" data-testid="no-backlog">
        Não há tarefas no backlog para adicionar. Crie tarefas na página Tarefas.
      </p>

      <section v-for="group in groups" :key="group.area.id" :aria-label="`Área ${group.area.name}`">
        <h3 class="mb-1 flex items-center gap-2 text-sm font-semibold">
          <span class="size-2 rounded-full" :style="{ backgroundColor: group.area.color }" aria-hidden="true" />
          {{ group.area.name }}
        </h3>
        <ul class="flex flex-col gap-2">
          <li
            v-for="task in group.tasks"
            :key="task.id"
            class="flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-center"
            :class="returnedFromSprint(task) ? 'border-warning/50 bg-warning-soft/30' : 'border-border'"
            :data-testid="`backlog-${task.id}`"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ task.title }}</p>
              <div class="mt-1 flex flex-wrap items-center gap-1">
                <BaseBadge v-if="returnedFromSprint(task)" tone="warning" data-testid="returned-badge">
                  Não concluída no sprint de {{ formatDate(returnedFromSprint(task)).slice(0, 5) }}
                </BaseBadge>
                <BaseBadge v-if="task.estimateMinutes">{{ formatMinutes(task.estimateMinutes) }}</BaseBadge>
                <BaseBadge v-if="task.difficulty">{{ labelOf(TASK_DIFFICULTIES, task.difficulty) }}</BaseBadge>
                <BaseBadge v-if="task.priority">{{ labelOf(TASK_PRIORITIES, task.priority) }}</BaseBadge>
                <span
                  v-if="missingFields(task).length"
                  class="bg-warning-soft text-warning inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  data-testid="missing-fields"
                >
                  <TriangleAlert class="size-3" aria-hidden="true" />
                  Faltam: {{ missingFields(task).join(', ') }}
                </span>
              </div>
            </div>
            <BaseButton
              variant="outline"
              size="sm"
              :disabled="saving || !day || missingFields(task).length > 0"
              :aria-label="`Adicionar ${task.title} ao sprint`"
              @click="day && emit('add', task.id, day)"
            >
              <Plus class="size-4" aria-hidden="true" />
              Adicionar
            </BaseButton>
          </li>
        </ul>
      </section>
    </div>
  </BaseModal>
</template>
