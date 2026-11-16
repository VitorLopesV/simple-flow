<script setup lang="ts">
import { CalendarCheck, Pencil, Plus, Trash2 } from '@lucide/vue'
import { onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import RoutineForm from '@/components/features/RoutineForm.vue'
import RoutinePreview from '@/components/features/RoutinePreview.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notify } from '@/composables/useNotify'
import { useRoutineStore } from '@/stores/routineStore'
import type { RoutineItem, RoutinePayload } from '@/types/routine'
import { ROUTINE_WEEKDAYS } from '@/types/routine'
import { formatDate } from '@/utils/dateFormatter'

const store = useRoutineStore()

const modalOpen = ref(false)
const editing = ref<RoutineItem | null>(null)
const removeOpen = ref(false)
const toRemove = ref<RoutineItem | null>(null)

onMounted(() => void store.load())
watch(
  () => store.error,
  (error) => error && notify.error(error),
)

/** Resumo da regra de repetição para o cartão do item. */
function repeatSummary(item: RoutineItem): string {
  const { repeat } = item
  if (repeat.mode === 'DIAS_DA_SEMANA') {
    const labels = ROUTINE_WEEKDAYS.filter((day) => repeat.days.includes(day.value)).map((day) => day.short)
    return labels.join(', ')
  }
  const every = repeat.interval === 1 ? 'Todo dia' : `A cada ${repeat.interval} dias`
  return `${every}, a partir de ${formatDate(repeat.startDate)}`
}

function timesSummary(item: RoutineItem): string {
  const count = item.times.length
  const hours = item.times.map((slot) => slot.time).filter((time): time is string => time !== null)
  const base = count === 1 ? '1 vez por dia' : `${count} vezes por dia`
  return hours.length ? `${base} (${hours.join(', ')})` : base
}

function openNew(): void {
  editing.value = null
  modalOpen.value = true
}

function openEdit(item: RoutineItem): void {
  editing.value = item
  modalOpen.value = true
}

async function save(payload: RoutinePayload): Promise<void> {
  const current = editing.value
  const success = current ? await store.update(current.id, payload) : await store.create(payload)
  if (!success) return

  notify.success(current ? 'Item atualizado' : 'Item adicionado', payload.name)
  modalOpen.value = false
  editing.value = null
}

function askRemove(item: RoutineItem): void {
  toRemove.value = item
  removeOpen.value = true
}

async function confirmRemove(): Promise<void> {
  const item = toRemove.value
  if (!item) return
  if (await store.remove(item.id)) {
    notify.success('Item excluído', item.name)
    removeOpen.value = false
    toRemove.value = null
  }
}
</script>

<template>
  <PageLayout title="Rotina" description="Suas missões diárias da semana">
    <template #actions>
      <BaseButton variant="success" class="!h-11" @click="openNew">
        <Plus class="size-4" aria-hidden="true" />
        Novo item
      </BaseButton>
    </template>

    <p
      class="bg-card border-border rounded-card text-muted-foreground border px-4 py-3 text-sm"
      data-testid="next-sprint-notice"
    >
      As alterações na rotina valem a partir do próximo sprint; o sprint em andamento não muda.
    </p>

    <section class="flex flex-col gap-3" aria-label="Itens da rotina">
      <div v-if="store.loading && !store.items.length" class="bg-card border-border rounded-card border p-4">
        <BaseSkeleton :lines="2" height="h-6" />
      </div>

      <ul v-else-if="store.items.length" class="flex flex-col gap-3">
        <li
          v-for="item in store.items"
          :key="item.id"
          class="bg-card border-border rounded-card flex flex-col gap-3 border p-4"
          :data-testid="`routine-${item.id}`"
        >
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <h2 class="truncate font-medium">{{ item.name }}</h2>
              <p class="text-muted-foreground text-sm">
                {{ repeatSummary(item) }} · {{ timesSummary(item) }}
              </p>
            </div>
            <div class="flex gap-1">
              <BaseButton
                variant="ghost"
                size="icon"
                :aria-label="`Editar ${item.name}`"
                @click="openEdit(item)"
              >
                <Pencil class="size-4" aria-hidden="true" />
              </BaseButton>
              <BaseButton
                variant="ghost"
                size="icon"
                class="hover:text-danger"
                :aria-label="`Excluir ${item.name}`"
                @click="askRemove(item)"
              >
                <Trash2 class="size-4" aria-hidden="true" />
              </BaseButton>
            </div>
          </div>
          <RoutinePreview :item="item" />
        </li>
      </ul>

      <BaseCard v-else-if="store.isEmpty" no-padding>
        <EmptyState
          title="Sua rotina está vazia"
          description="Adicione itens como tomar remédio ou treinar e escolha quando se repetem."
        >
          <template #icon>
            <CalendarCheck class="size-6" aria-hidden="true" />
          </template>
          <template #action>
            <BaseButton variant="outline" @click="openNew">
              <Plus class="size-4" aria-hidden="true" />
              Adicionar item
            </BaseButton>
          </template>
        </EmptyState>
      </BaseCard>
    </section>

    <BaseModal v-model:open="modalOpen" :title="editing ? 'Editar item' : 'Novo item'" width="md">
      <RoutineForm :item="editing" :saving="store.saving" @save="save" @cancel="modalOpen = false" />
    </BaseModal>

    <ConfirmDialog
      v-model:open="removeOpen"
      title="Excluir item"
      :message="`Excluir o item ${toRemove?.name ?? ''} da rotina? Essa ação não pode ser desfeita.`"
      confirm-text="Excluir"
      :loading="store.saving"
      @confirm="confirmRemove"
    />
  </PageLayout>
</template>
