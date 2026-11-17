<script setup lang="ts">
import { ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import type { Area } from '@/types/area'

/** Serve para tarefa e para Super task: só precisa do título e da área atual. */
const props = withDefaults(
  defineProps<{
    task: { title: string; areaId: string } | null
    areas: Area[]
    loading?: boolean
    title?: string
  }>(),
  { loading: false, title: 'Mover tarefa' },
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [areaId: string] }>()

const targetAreaId = ref<string | null>(null)

/** Destinos: as outras áreas do usuário (a Rotina não aceita tarefas). */
function targets(): Area[] {
  return props.areas.filter((item) => item.id !== props.task?.areaId && !item.system)
}

watch(open, (isOpen) => {
  if (isOpen) targetAreaId.value = targets()[0]?.id ?? null
})

function confirm(): void {
  if (targetAreaId.value) emit('confirm', targetAreaId.value)
}
</script>

<template>
  <BaseModal v-model:open="open" :title="title" :description="task?.title" width="sm">
    <p v-if="!targets().length" class="text-muted-foreground text-sm">
      Crie outra área para poder mover a tarefa.
    </p>
    <BaseSelect
      v-else
      v-model="targetAreaId"
      label="Área de destino"
      :options="targets().map((item) => ({ label: item.name, value: item.id }))"
    />

    <div class="flex justify-end gap-2 pt-4">
      <BaseButton variant="outline" :disabled="loading" @click="open = false">Cancelar</BaseButton>
      <BaseButton :loading="loading" :disabled="!targetAreaId" @click="confirm">Mover</BaseButton>
    </div>
  </BaseModal>
</template>
