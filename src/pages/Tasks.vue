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
import SuperTaskBlock from '@/components/features/SuperTaskBlock.vue'
import SuperTaskConvertDialog from '@/components/features/SuperTaskConvertDialog.vue'
import SuperTaskDeleteDialog from '@/components/features/SuperTaskDeleteDialog.vue'
import SuperTaskForm from '@/components/features/SuperTaskForm.vue'
import TaskForm from '@/components/features/TaskForm.vue'
import TaskItem from '@/components/features/TaskItem.vue'
import TaskMoveDialog from '@/components/features/TaskMoveDialog.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notify } from '@/composables/useNotify'
import { useAreaStore } from '@/stores/areaStore'
import { useSuperTaskStore } from '@/stores/superTaskStore'
import { useTaskStore } from '@/stores/taskStore'
import type { Area, AreaPayload, AreaTasksDestination } from '@/types/area'
import type { SuperTask, SuperTaskChildrenDestination, SuperTaskEdit } from '@/types/superTask'
import type { Task, TaskEdit } from '@/types/task'
import { fullPoints, latePoints, wouldBeLate } from '@/utils/taskCompletion'

const areaStore = useAreaStore()
const taskStore = useTaskStore()
const superTaskStore = useSuperTaskStore()

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

// Super task: formulário (criar/editar), conversão, mover e excluir.
const superTaskModalOpen = ref(false)
const editingSuperTask = ref<SuperTask | null>(null)
const superTaskAreaId = ref<string | null>(null)
const convertOpen = ref(false)
const taskToConvert = ref<Task | null>(null)
const moveSuperTaskOpen = ref(false)
const movingSuperTask = ref<SuperTask | null>(null)
const deleteSuperTaskOpen = ref(false)
const superTaskToDelete = ref<SuperTask | null>(null)

onMounted(() => void Promise.all([areaStore.load(), taskStore.load(), superTaskStore.load()]))
watch(
  () => areaStore.error,
  (error) => error && notify.error(error),
)
watch(
  () => taskStore.error,
  (error) => error && notify.error(error),
)
watch(
  () => superTaskStore.error,
  (error) => error && notify.error(error),
)

/** Tarefas avulsas da área: as filhas aparecem só dentro do bloco da Super task. */
function standaloneByArea(areaId: string): Task[] {
  return taskStore.byArea(areaId).filter((task) => !task.superTaskId)
}

/** Avulsas abertas e não arquivadas da área: candidatas a virar filha. */
function candidatesOf(superTask: SuperTask): Task[] {
  return standaloneByArea(superTask.areaId).filter((task) => !task.done && !task.archived)
}

/** Mudar uma tarefa pode mudar o progresso (ou concluir) a Super task dela: recarrega as Super tasks. */
async function refreshSuperTasks(): Promise<void> {
  await superTaskStore.load()
}

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
    await Promise.all([taskStore.load(), superTaskStore.load()])
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
  await refreshSuperTasks()
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
  if (await taskStore.archive(task.id)) {
    await refreshSuperTasks()
    notify.success('Tarefa arquivada', task.title)
  }
}

async function unarchiveTask(task: Task): Promise<void> {
  if (await taskStore.unarchive(task.id)) {
    await refreshSuperTasks()
    notify.success('Tarefa desarquivada', task.title)
  }
}

function askComplete(task: Task): void {
  taskToComplete.value = task
  completeOpen.value = true
}

async function confirmComplete(): Promise<void> {
  const task = taskToComplete.value
  if (!task) return
  if (await taskStore.complete(task.id)) {
    // Ao concluir a última filha o backend conclui a Super task: recarrega para refletir na hora.
    await refreshSuperTasks()
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
    await refreshSuperTasks()
    notify.success('Tarefa excluída', task.title)
    removeTaskOpen.value = false
    taskToRemove.value = null
  }
}

// ------------------------------------------------------------- Super task

function openNewSuperTask(area: Area): void {
  editingSuperTask.value = null
  superTaskAreaId.value = area.id
  superTaskModalOpen.value = true
}

function openEditSuperTask(superTask: SuperTask): void {
  editingSuperTask.value = superTask
  superTaskAreaId.value = superTask.areaId
  superTaskModalOpen.value = true
}

async function saveSuperTask(edit: SuperTaskEdit): Promise<void> {
  const current = editingSuperTask.value
  const areaId = superTaskAreaId.value
  if (!current && !areaId) return
  const success = current
    ? await superTaskStore.update(current.id, edit)
    : await superTaskStore.create({ ...edit, areaId: areaId! })
  if (!success) return
  notify.success(current ? 'Super task atualizada' : 'Super task criada', edit.title)
  superTaskModalOpen.value = false
  editingSuperTask.value = null
}

function askConvert(task: Task): void {
  taskToConvert.value = task
  convertOpen.value = true
}

async function confirmConvert(endDate: string | null): Promise<void> {
  const task = taskToConvert.value
  if (!task) return
  if (await superTaskStore.convert(task.id, endDate)) {
    // A tarefa original some: recarrega o backlog.
    await taskStore.load()
    notify.success('Tarefa transformada em Super task', task.title)
    convertOpen.value = false
    taskToConvert.value = null
  }
}

async function addChild(superTask: SuperTask, title: string): Promise<void> {
  const success = await superTaskStore.createChild(superTask.id, {
    areaId: superTask.areaId,
    title,
    day: null,
    time: null,
    estimateMinutes: null,
    difficulty: null,
    priority: null,
    notes: null,
  })
  if (success) await taskStore.load()
}

async function addTaskToSuperTask(superTask: SuperTask, taskId: string): Promise<void> {
  if (await superTaskStore.addTask(superTask.id, taskId)) await taskStore.load()
}

async function unlinkTask(superTask: SuperTask, task: Task): Promise<void> {
  if (await superTaskStore.removeTask(superTask.id, task.id)) {
    await taskStore.load()
    notify.success('Tarefa retirada da Super task', task.title)
  }
}

/** Sem modal de confirmação: marcar (só em 100%) e desmarcar são diretos. */
async function completeSuperTask(superTask: SuperTask): Promise<void> {
  if (await superTaskStore.complete(superTask.id)) notify.success('Super task concluída', superTask.title)
}

async function reopenSuperTask(superTask: SuperTask): Promise<void> {
  if (await superTaskStore.reopen(superTask.id)) notify.success('Super task reaberta', superTask.title)
}

function askMoveSuperTask(superTask: SuperTask): void {
  movingSuperTask.value = superTask
  moveSuperTaskOpen.value = true
}

async function confirmMoveSuperTask(areaId: string): Promise<void> {
  const superTask = movingSuperTask.value
  if (!superTask) return
  if (await superTaskStore.move(superTask.id, areaId)) {
    await taskStore.load()
    notify.success('Super task movida', superTask.title)
    moveSuperTaskOpen.value = false
    movingSuperTask.value = null
  }
}

function askDeleteSuperTask(superTask: SuperTask): void {
  superTaskToDelete.value = superTask
  deleteSuperTaskOpen.value = true
}

async function confirmDeleteSuperTask(children: SuperTaskChildrenDestination): Promise<void> {
  const superTask = superTaskToDelete.value
  if (!superTask) return
  if (await superTaskStore.remove(superTask.id, children)) {
    await taskStore.load()
    notify.success('Super task excluída', superTask.title)
    deleteSuperTaskOpen.value = false
    superTaskToDelete.value = null
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
                  :aria-label="`Nova Super task em ${area.name}`"
                  title="Nova Super task"
                  data-testid="new-super-task"
                  @click="openNewSuperTask(area)"
                >
                  <Layers class="size-4" aria-hidden="true" />
                </BaseButton>
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
            <template v-else>
              <ul v-if="superTaskStore.byArea(area.id).length" :aria-label="`Super tasks de ${area.name}`">
                <SuperTaskBlock
                  v-for="superTask in superTaskStore.byArea(area.id)"
                  :key="superTask.id"
                  :super-task="superTask"
                  :candidates="candidatesOf(superTask)"
                  :busy="superTaskStore.saving || taskStore.saving"
                  @edit="openEditSuperTask(superTask)"
                  @move="askMoveSuperTask(superTask)"
                  @remove="askDeleteSuperTask(superTask)"
                  @complete="completeSuperTask(superTask)"
                  @reopen="reopenSuperTask(superTask)"
                  @add-child="(title) => addChild(superTask, title)"
                  @add-task="(taskId) => addTaskToSuperTask(superTask, taskId)"
                  @task-edit="openEditTask"
                  @task-archive="archiveTask"
                  @task-unarchive="unarchiveTask"
                  @task-complete="askComplete"
                  @task-remove="askRemoveTask"
                  @task-unlink="(task) => unlinkTask(superTask, task)"
                />
              </ul>
              <ul v-if="standaloneByArea(area.id).length" class="border-border border-t">
              <TaskItem
                v-for="task in standaloneByArea(area.id)"
                :key="task.id"
                :task="task"
                @edit="openEditTask(task)"
                @move="askMove(task)"
                @archive="archiveTask(task)"
                @unarchive="unarchiveTask(task)"
                @complete="askComplete(task)"
                @remove="askRemoveTask(task)"
                @convert="askConvert(task)"
              />
              </ul>
              <p
                v-if="!standaloneByArea(area.id).length && !superTaskStore.byArea(area.id).length"
                class="text-muted-foreground border-border border-t px-4 py-3 text-sm"
              >
                Nenhuma tarefa nesta área ainda.
              </p>
            </template>
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

    <BaseModal
      v-model:open="superTaskModalOpen"
      :title="editingSuperTask ? 'Editar Super task' : 'Nova Super task'"
      width="md"
    >
      <SuperTaskForm
        :super-task="editingSuperTask"
        :saving="superTaskStore.saving"
        @save="saveSuperTask"
        @cancel="superTaskModalOpen = false"
      />
    </BaseModal>

    <SuperTaskConvertDialog
      v-model:open="convertOpen"
      :task="taskToConvert"
      :loading="superTaskStore.saving"
      @confirm="confirmConvert"
    />

    <TaskMoveDialog
      v-model:open="moveSuperTaskOpen"
      title="Mover Super task"
      :task="movingSuperTask"
      :areas="areaStore.areas"
      :loading="superTaskStore.saving"
      @confirm="confirmMoveSuperTask"
    />

    <SuperTaskDeleteDialog
      v-model:open="deleteSuperTaskOpen"
      :super-task="superTaskToDelete"
      :loading="superTaskStore.saving"
      @confirm="confirmDeleteSuperTask"
    />

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
