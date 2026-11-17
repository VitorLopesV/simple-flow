<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import CompleteConfirmDialog from '@/components/features/CompleteConfirmDialog.vue'
import HomeFinances from '@/components/features/HomeFinances.vue'
import HomeMission from '@/components/features/HomeMission.vue'
import HomeTodayTasks from '@/components/features/HomeTodayTasks.vue'
import HomeWeekBills from '@/components/features/HomeWeekBills.vue'
import PlanningReminder from '@/components/features/PlanningReminder.vue'
import SprintScoreboard from '@/components/features/SprintScoreboard.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notify } from '@/composables/useNotify'
import { useAuthStore } from '@/stores/authStore'
import { useHomeStore } from '@/stores/homeStore'
import { useNotificationStore } from '@/stores/notificationStore'
import type { HomeOccurrence, HomeTask } from '@/types/home'
import { fullPoints, latePoints } from '@/utils/taskCompletion'

const authStore = useAuthStore()
const store = useHomeStore()
const notificationStore = useNotificationStore()

const completeOpen = ref(false)
const taskToComplete = ref<HomeTask | null>(null)
const occurrenceToComplete = ref<HomeOccurrence | null>(null)

onMounted(() => store.load())

// Sem resumo na tela o erro aparece no próprio lugar do conteúdo; com resumo (falha ao concluir), vira toast.
watch(
  () => store.error,
  (error) => error && store.summary && notify.error(error),
)

const summary = computed(() => store.summary)

function askCompleteTask(task: HomeTask): void {
  taskToComplete.value = task
  occurrenceToComplete.value = null
  completeOpen.value = true
}

function askCompleteOccurrence(occurrence: HomeOccurrence): void {
  occurrenceToComplete.value = occurrence
  taskToComplete.value = null
  completeOpen.value = true
}

/** Concluir é definitivo: só acontece depois da confirmação, a mesma do Sprint (F#144). */
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
  // Concluir pode apagar um alerta (tarefa atrasada, rotina incompleta): atualiza o sino.
  void notificationStore.load()
}
</script>

<template>
  <PageLayout title="Início" description="O que fazer hoje e como está a semana">
    <!-- Domingo (America/Sao_Paulo): convida a planejar o próximo sprint. -->
    <PlanningReminder>
      <template #actions>
        <RouterLink
          :to="{ name: 'sprint' }"
          class="bg-primary text-primary-foreground focus-visible:outline-ring rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2"
          data-testid="planning-link"
        >
          Planejar a semana
        </RouterLink>
      </template>
    </PlanningReminder>

    <p class="text-muted-foreground -mt-3 text-sm">
      Olá<template v-if="authStore.user?.name">, {{ authStore.user.name }}</template>!
    </p>

    <div v-if="store.loading && !summary" class="bg-card border-border rounded-card border p-4" data-testid="home-loading">
      <BaseSkeleton :lines="4" height="h-6" />
    </div>

    <div
      v-else-if="!summary"
      class="bg-card border-border rounded-card flex flex-col items-start gap-3 border p-4"
      data-testid="home-error"
    >
      <p class="text-danger text-sm" role="alert">{{ store.error ?? 'Não foi possível carregar a página inicial.' }}</p>
      <BaseButton size="sm" variant="outline" @click="store.load()">Tentar de novo</BaseButton>
    </div>

    <template v-else>
      <!-- Fim de semana: o sprint "atual" é o que acabou de fechar, então o placar é a foto do resultado. -->
      <SprintScoreboard
        :scoreboard="summary.scoreboard"
        :closed="summary.scoreboard.closed"
        :reward="summary.scoreboard.reward"
      />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="flex min-w-0 flex-col gap-4">
          <HomeMission
            :today="summary.today"
            :completed="summary.mission.completed"
            :total="summary.mission.total"
            :occurrences="summary.mission.occurrences"
            :reminders="summary.reminders"
            :weekend="summary.weekend"
            :busy="store.saving"
            @complete="askCompleteOccurrence"
          />
          <HomeTodayTasks :tasks="summary.todayTasks" :busy="store.saving" @complete="askCompleteTask" />
        </div>
        <div class="flex min-w-0 flex-col gap-4">
          <HomeWeekBills
            :bills="summary.weekBills.bills"
            :total="summary.weekBills.total"
            :count="summary.weekBills.count"
          />
          <HomeFinances :finances="summary.finances" />
        </div>
      </div>
    </template>

    <CompleteConfirmDialog
      v-model:open="completeOpen"
      :kind="occurrenceToComplete ? 'routine' : 'task'"
      :name="taskToComplete?.title ?? occurrenceToComplete?.name ?? ''"
      :overdue="taskToComplete ? taskToComplete.overdue && taskToComplete.inSprint : false"
      :points="taskToComplete ? fullPoints(taskToComplete) : null"
      :reduced-points="taskToComplete ? latePoints(taskToComplete) : null"
      :loading="store.saving"
      @confirm="confirmComplete"
    />
  </PageLayout>
</template>
