<script setup lang="ts">
import { Layers, Pencil, Plus, Trash2 } from '@lucide/vue'
import { onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import AreaDeleteDialog from '@/components/features/AreaDeleteDialog.vue'
import AreaForm from '@/components/features/AreaForm.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notify } from '@/composables/useNotify'
import { useAreaStore } from '@/stores/areaStore'
import type { Area, AreaPayload, AreaTasksDestination } from '@/types/area'

const areaStore = useAreaStore()

const modalOpen = ref(false)
const editing = ref<Area | null>(null)
const deleteOpen = ref(false)
const toDelete = ref<Area | null>(null)

onMounted(() => void areaStore.load())
watch(
  () => areaStore.error,
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
    notify.success('Área excluída', area.name)
    deleteOpen.value = false
    toDelete.value = null
  }
}
</script>

<template>
  <PageLayout title="Tarefas" description="Organize suas tarefas em áreas">
    <template #actions>
      <BaseButton variant="success" class="!h-11" @click="openNew">
        <Plus class="size-4" aria-hidden="true" />
        Nova área
      </BaseButton>
    </template>

    <section class="flex flex-col gap-3" aria-label="Áreas">
      <div
        v-if="areaStore.loading && !areaStore.areas.length"
        class="bg-card border-border rounded-card border p-4"
      >
        <BaseSkeleton :lines="2" height="h-6" />
      </div>

      <template v-else>
        <ul class="flex flex-col gap-3">
          <li
            v-for="area in areaStore.areas"
            :key="area.id"
            class="bg-card border-border rounded-card flex items-center gap-3 border p-4"
            :data-testid="`area-${area.id}`"
          >
            <span
              class="size-3 shrink-0 rounded-full"
              :style="{ backgroundColor: area.color }"
              aria-hidden="true"
            />
            <span class="flex-1 truncate font-medium">{{ area.name }}</span>

            <!-- A Rotina é fixa: sem ações de editar e excluir. -->
            <div v-if="!area.system" class="flex gap-1">
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

    <AreaDeleteDialog
      v-model:open="deleteOpen"
      :area="toDelete"
      :areas="areaStore.areas"
      :loading="areaStore.saving"
      @confirm="confirmDelete"
    />
  </PageLayout>
</template>
