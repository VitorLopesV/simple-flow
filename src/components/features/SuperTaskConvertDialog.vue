<script setup lang="ts">
import { ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import DateInput from '@/components/common/DateInput.vue'
import type { Task } from '@/types/task'
import { isoDate } from '@/utils/validators'

const props = withDefaults(defineProps<{ task: Task | null; loading?: boolean }>(), { loading: false })

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [endDate: string | null] }>()

const endDate = ref('')
const error = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  endDate.value = ''
  error.value = ''
})

function confirm(): void {
  const result = endDate.value ? isoDate('Data de término')(endDate.value) : true
  if (result !== true) {
    error.value = result
    return
  }
  emit('confirm', endDate.value || null)
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Transformar em Super task"
    :description="props.task?.title"
    width="sm"
  >
    <p class="text-muted-foreground mb-3 text-sm">
      O título, a área e as notas passam para a Super task e a tarefa original deixa de existir. Dia, hora, tempo,
      dificuldade e prioridade não são mantidos.
    </p>
    <DateInput v-model="endDate" label="Data de término" hint="Opcional." :error="error" />

    <template #footer>
      <div class="flex justify-end gap-2">
        <BaseButton variant="outline" :disabled="loading" @click="open = false">Cancelar</BaseButton>
        <BaseButton :loading="loading" @click="confirm">Transformar</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
