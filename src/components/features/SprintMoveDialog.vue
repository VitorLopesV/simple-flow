<script setup lang="ts">
import { ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import type { SprintColumn } from '@/stores/sprintStore'
import type { Task } from '@/types/task'
import { formatDate } from '@/utils/dateFormatter'

const props = withDefaults(defineProps<{ task: Task | null; days: SprintColumn[]; loading?: boolean }>(), {
  loading: false,
})

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [day: string] }>()

const targetDay = ref<string | null>(null)

/** Destinos: hoje e os dias futuros, menos o dia atual da tarefa. */
function targets(): SprintColumn[] {
  return props.days.filter((day) => !day.locked && day.date !== props.task?.day)
}

watch(open, (isOpen) => {
  if (isOpen) targetDay.value = targets()[0]?.date ?? null
})

function confirm(): void {
  if (targetDay.value) emit('confirm', targetDay.value)
}
</script>

<template>
  <BaseModal v-model:open="open" title="Mover para outro dia" :description="task?.title" width="sm">
    <p v-if="!targets().length" class="text-muted-foreground text-sm">Não há outro dia disponível neste sprint.</p>
    <BaseSelect
      v-else
      v-model="targetDay"
      label="Dia de destino"
      :options="
        targets().map((day) => ({ label: `${day.label} (${formatDate(day.date).slice(0, 5)})`, value: day.date }))
      "
    />

    <div class="flex justify-end gap-2 pt-4">
      <BaseButton variant="outline" :disabled="loading" @click="open = false">Cancelar</BaseButton>
      <BaseButton :loading="loading" :disabled="!targetDay" @click="confirm">Mover</BaseButton>
    </div>
  </BaseModal>
</template>
