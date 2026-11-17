<script setup lang="ts">
import { Layers, Pencil, Plus, Trash2 } from '@lucide/vue'
import { onMounted, reactive, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import BaseSwitch from '@/components/common/BaseSwitch.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import AreaDeleteDialog from '@/components/features/AreaDeleteDialog.vue'
import AreaForm from '@/components/features/AreaForm.vue'
import CompleteConfirmDialog from '@/components/features/CompleteConfirmDialog.vue'
import TaskForm from '@/components/features/TaskForm.vue'
import TaskItem from '@/components/features/TaskItem.vue'
import TaskMoveDialog from '@/components/features/TaskMoveDialog.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notify } from '@/composables/useNotify'
import { useAreaStore } from '@/stores/areaStore'
import { useTaskStore } from '@/stores/taskStore'
import type { Area, AreaPayload, AreaTasksDestination } from '@/types/area'
import type { Task, TaskEdit } from '@/types/task'
import { fullPoints, latePoints, wouldBeLate } from '@/utils/taskCompletion'

const areaStore = useAreaStore()
const taskStore = useTaskStore()

const modalOpen = ref(false)
const editing = ref<Area | null>(null)
const deleteOpen = ref(false)
const toDelete = ref<Area | null>(null)

// Rascunho do título de criação rápida, por área.
const drafts = reactive<Record<string, string>>({})
const taskModalOpen = ref(false)
const editingTask = ref<Task | null>(null)
const moveOpen = ref(false)
const movingTask = ref<Task | null>(null)
const completeOpen = ref(false)
const taskToComplete = ref<Task | null>(null)
const removeTaskOpen = ref(false)
const taskToRemove = ref<Task | null>(null)

onMounted(() => void Promise.all([areaStore.load(), taskStore.load()]))
watch(
  () => areaStore.error,
  (error) => error && notify.error(error),
)
watch(
  () => taskStore.error,
  (error) => error && notify.error(error),
)

function openNew(): void {
  editing.value = null
  modalOpen.value = true
}

function openEdit(area: Area): void {
  editing.value = area
  modalOpen.value = true
}

async function save(payload: AreaPayload): Promise<void> {
  const current = editing.value
  const success = current
    ? await areaStore.update(current.id, payload)
    : await areaStore.create(payload)
  if (!success) return

  notify.success(current ? 'Área atualizada' : 'Área adicionada', payload.name)
  modalOpen.value = false
  editing.value = null
}

function askDelete(area: Area): void {
  toDelete.value = area
  deleteOpen.value = true
}

async function confirmDelete(destination: AreaTasksDestination): Promise<void> {
  const area = toDelete.value
  if (!area) return

  if (await areaStore.remove(area.id, destination)) {
    // As tarefas foram movidas ou excluídas junto: recarrega o backlog.
    await taskStore.load()
    notify.success('Área excluída', area.name)
    deleteOpen.value = false
    toDelete.value = null
  }
}

/** Criação rápida: só o título; o resto se preenche depois, na edição. */
async function quickCreate(area: Area): Promise<void> {
  const title = (drafts[area.id] ?? '').trim()
  if (!title) return
  const success = await taskStore.create({
    areaId: area.id,
    title,
    day: null,
    time: null,
    estimateMinutes: null,
    difficulty: null,
    priority: null,
    notes: null,
  })
  if (success) drafts[area.id] = ''
}

function openEditTask(task: Task): void {
  editingTask.value = task
  taskModalOpen.value = true
}

async function saveTask(edit: TaskEdit): Promise<void> {
  const task = editingTask.value
  if (!task) return
  if (!(await taskStore.update(task.id, edit))) return
  notify.success('Tarefa atualizada', edit.title)
  taskModalOpen.value = false
  editingTask.value = null
}

function askMove(task: Task): void {
  movingTask.value = task
  moveOpen.value = true
}

async function confirmMove(areaId: string): Promise<void> {
  const task = movingTask.value
  if (!task) return
  if (await taskStore.move(task.id, areaId)) {
    notify.success('Tarefa movida', task.title)
    moveOpen.value = false
    movingTask.value = null
  }
}

async function archiveTask(task: Task): Promise<void> {
  if (await taskStore.archive(task.id)) notify.success('Tarefa arquivada', task.title)
}

async function unarchiveTask(task: Task): Promise<void> {
  if (await taskStore.unarchive(task.id)) notify.success('Tarefa desarquivada', task.title)
}

function askComplete(task: Task): void {
  taskToComplete.value = task
  completeOpen.value = true
}

async function confirmComplete(): Promise<void> {
  const task = taskToComplete.value
  if (!task) return
  if (await taskStore.complete(task.id)) {
    notify.success('Tarefa concluída', task.title)
    completeOpen.value = false
    taskToComplete.value = null
  }
}

function askRemoveTask(task: Task): void {
  taskToRemove.value = task
  removeTaskOpen.value = true
}

async function confirmRemoveTask(): Promise<void> {
  const task = taskToRemove.value
  if (!task) return
  if (await taskStore.remove(task.id)) {
    notify.success('Tarefa excluída', task.title)
    removeTaskOpen.value = false
    taskToRemove.value = null
  }
}
</script>

<template>
  <PageLayout title="Tarefas" description="Seu backlog, organizado por área">
    <template #actions>
      <BaseButton variant="success" class="!h-11" @click="openNew">
        <Plus class="size-4" aria-hidden="true" />
        Nova área
      </BaseButton>
    </template>

    <section class="flex flex-col gap-3" aria-label="Áreas e tarefas">
      <div
        v-if="areaStore.loading && !areaStore.areas.length"
        class="bg-card border-border rounded-card border p-4"
      >
        <BaseSkeleton :lines="2" height="h-6" />
      </div>

      <template v-else>
        <BaseSwitch
          :model-value="taskStore.showArchived"
          label="Mostrar arquivadas"
          description="Inclui as tarefas arquivadas na lista"
          @update:model-value="taskStore.setShowArchived"
        />

        <ul class="flex flex-col gap-3">
          <!-- A Rotina não recebe tarefas do backlog: só as áreas do usuário aparecem. -->
          <li
            v-for="area in areaStore.customAreas"
            :key="area.id"
            class="bg-card border-border rounded-card overflow-hidden border"
            :data-testid="`area-${area.id}`"
          >
            <div class="flex items-center gap-3 p-4">
              <span
                class="size-3 shrink-0 rounded-full"
                :style="{ backgroundColor: area.color }"
                aria-hidden="true"
              />
              <h2 class="flex-1 truncate font-medium">{{ area.name }}</h2>

              <div class="flex gap-1">
                <BaseButton
                  variant="ghost"
                  size="icon"
                  :aria-label="`Editar ${area.name}`"
                  @click="openEdit(area)"
                >
                  <Pencil class="size-4" aria-hidden="true" />
                </BaseButton>
                <BaseButton
                  variant="ghost"
                  size="icon"
                  class="hover:text-danger"
                  :aria-label="`Excluir ${area.name}`"
                  @click="askDelete(area)"
                >
                  <Trash2 class="size-4" aria-hidden="true" />
                </BaseButton>
              </div>
            </div>

            <form
              class="border-border flex items-center gap-2 border-t px-4 py-3"
              novalidate
              @submit.prevent="quickCreate(area)"
            >
              <BaseInput
                v-model="drafts[area.id]"
                class="flex-1"
                :aria-label="`Nova tarefa em ${area.name}`"
                placeholder="Adicionar tarefa (só o título)"
                :maxlength="200"
                autocomplete="off"
              />
              <BaseButton type="submit" variant="outline" :disabled="taskStore.saving">
                <Plus class="size-4" aria-hidden="true" />
                Adicionar
              </BaseButton>
            </form>

            <div v-if="taskStore.loading && !taskStore.tasks.length" class="border-border border-t p-4">
              <BaseSkeleton :lines="2" height="h-5" />
            </div>
            <ul v-else-if="taskStore.byArea(area.id).length" class="border-border border-t">
              <TaskItem
                v-for="task in taskStore.byArea(area.id)"
                :key="task.id"
                :task="task"
                @edit="openEditTask(task)"
                @move="askMove(task)"
                @archive="archiveTask(task)"
                @unarchive="unarchiveTask(task)"
                @complete="askComplete(task)"
                @remove="askRemoveTask(task)"
              />
            </ul>
            <p v-else class="text-muted-foreground border-border border-t px-4 py-3 text-sm">
              Nenhuma tarefa nesta área ainda.
            </p>
          </li>
        </ul>

        <BaseCard v-if="areaStore.isEmpty" no-padding>
          <EmptyState
            title="Você ainda não criou áreas"
            description="Crie áreas como Trabalho, Faculdade ou Família para organizar suas tarefas."
          >
            <template #icon>
              <Layers class="size-6" aria-hidden="true" />
            </template>
            <template #action>
              <BaseButton variant="outline" @click="openNew">
                <Plus class="size-4" aria-hidden="true" />
                Adicionar área
              </BaseButton>
            </template>
          </EmptyState>
        </BaseCard>
      </template>
    </section>

    <BaseModal v-model:open="modalOpen" :title="editing ? 'Editar área' : 'Nova área'" width="sm">
      <AreaForm :area="editing" :saving="areaStore.saving" @save="save" @cancel="modalOpen = false" />
    </BaseModal>

    <BaseModal v-model:open="taskModalOpen" title="Editar tarefa" width="md">
      <TaskForm
        v-if="editingTask"
        :task="editingTask"
        :saving="taskStore.saving"
        @save="saveTask"
        @cancel="taskModalOpen = false"
      />
    </BaseModal>

    <TaskMoveDialog
      v-model:open="moveOpen"
      :task="movingTask"
      :areas="areaStore.areas"
      :loading="taskStore.saving"
      @confirm="confirmMove"
    />

    <CompleteConfirmDialog
      v-model:open="completeOpen"
      kind="task"
      :name="taskToComplete?.title ?? ''"
      :overdue="taskToComplete ? wouldBeLate(taskToComplete) : false"
      :points="taskToComplete ? fullPoints(taskToComplete) : null"
      :reduced-points="taskToComplete ? latePoints(taskToComplete) : null"
      :loading="taskStore.saving"
      @confirm="confirmComplete"
    />

    <ConfirmDialog
      v-model:open="removeTaskOpen"
      title="Excluir tarefa"
      :message="`Excluir a tarefa ${taskToRemove?.title ?? ''}? Essa ação não pode ser desfeita.`"
      confirm-text="Excluir"
      :loading="taskStore.saving"
      @confirm="confirmRemoveTask"
    />

    <AreaDeleteDialog
      v-model:open="deleteOpen"
      :area="toDelete"
      :areas="areaStore.areas"
      :loading="areaStore.saving"
      @confirm="confirmDelete"
    />
  </PageLayout>
</template>
