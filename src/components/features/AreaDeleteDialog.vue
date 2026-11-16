<script setup lang="ts">
import { ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import type { Area, AreaTasksDestination } from '@/types/area'

const props = withDefaults(
  defineProps<{ area: Area | null; areas: Area[]; loading?: boolean }>(),
  { loading: false },
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [destination: AreaTasksDestination] }>()

const choice = ref<'move' | 'delete'>('move')
const targetAreaId = ref<string | null>(null)

/** Destinos possíveis: outras áreas do usuário (a Rotina não aceita tarefas). */
function targets(): Area[] {
  return props.areas.filter((item) => item.id !== props.area?.id && !item.system)
}

watch(open, (isOpen) => {
  if (!isOpen) return
  choice.value = targets().length ? 'move' : 'delete'
  targetAreaId.value = targets()[0]?.id ?? null
})

function confirm(): void {
  if (choice.value === 'move') {
    if (!targetAreaId.value) return
    emit('confirm', { action: 'move', targetAreaId: targetAreaId.value })
    return
  }
  emit('confirm', { action: 'delete' })
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="`Excluir a área ${area?.name ?? ''}`"
    description="Escolha o que fazer com as tarefas dessa área."
    width="sm"
  >
    <fieldset class="flex flex-col gap-3 text-sm">
      <legend class="sr-only">Destino das tarefas</legend>

      <label class="flex cursor-pointer items-start gap-2">
        <input
          v-model="choice"
          type="radio"
          name="area-tasks"
          value="move"
          class="mt-1"
          :disabled="!targets().length"
        />
        <span>
          Mover as tarefas para outra área
          <span v-if="!targets().length" class="text-muted-foreground block text-xs">
            Crie outra área para poder mover as tarefas.
          </span>
        </span>
      </label>
      <BaseSelect
        v-if="choice === 'move'"
        v-model="targetAreaId"
        label="Área de destino"
        :options="targets().map((item) => ({ label: item.name, value: item.id }))"
      />

      <label class="flex cursor-pointer items-start gap-2">
        <input v-model="choice" type="radio" name="area-tasks" value="delete" class="mt-1" />
        <span>Excluir as tarefas junto com a área</span>
      </label>
      <p v-if="choice === 'delete'" class="text-danger text-xs" role="alert">
        As tarefas serão excluídas e essa ação não pode ser desfeita.
      </p>
    </fieldset>

    <template #footer>
      <div class="flex justify-end gap-2">
        <BaseButton variant="outline" :disabled="loading" @click="open = false">Cancelar</BaseButton>
        <BaseButton variant="danger" :loading="loading" @click="confirm">Excluir área</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
