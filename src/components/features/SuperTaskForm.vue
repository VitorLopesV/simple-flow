<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { computed, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseTextarea from '@/components/common/BaseTextarea.vue'
import DateInput from '@/components/common/DateInput.vue'
import type { SuperTask, SuperTaskEdit } from '@/types/superTask'
import { compose, isoDate, maxLength, required } from '@/utils/validators'
import type { Rule } from '@/utils/validators'

interface FormValues {
  title: string
  endDate: string
  notes: string
}

/** Sem `superTask` o formulário cria; com ela, edita. */
const props = withDefaults(defineProps<{ superTask?: SuperTask | null; saving?: boolean }>(), {
  superTask: null,
  saving: false,
})

const emit = defineEmits<{ save: [edit: SuperTaskEdit]; cancel: [] }>()

const isEditing = computed(() => Boolean(props.superTask))

/** A Data de término é opcional: só valida quando preenchida. */
const optionalDate: Rule = (value) => (String(value ?? '').trim() === '' ? true : isoDate('Data de término')(value))

function initialValues(): FormValues {
  return {
    title: props.superTask?.title ?? '',
    endDate: props.superTask?.endDate ?? '',
    notes: props.superTask?.notes ?? '',
  }
}

const { handleSubmit, resetForm } = useForm<FormValues>({
  initialValues: initialValues(),
  validationSchema: {
    title: compose(required('Título'), maxLength(200, 'Título')),
    endDate: optionalDate,
    notes: maxLength(2000, 'Notas'),
  },
})

const { value: title, errorMessage: titleError } = useField<string>('title')
const { value: endDate, errorMessage: endDateError } = useField<string>('endDate')
const { value: notes, errorMessage: notesError } = useField<string>('notes')

watch(
  () => props.superTask,
  () => resetForm({ values: initialValues() }),
)

const onSubmit = handleSubmit((form) => {
  emit('save', {
    title: form.title.trim(),
    endDate: form.endDate || null,
    notes: form.notes.trim() || null,
  })
})
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit="onSubmit">
    <BaseInput
      v-model="title"
      label="Título da Super task"
      placeholder="Ex.: Reforma da casa"
      :error="titleError"
      required
      :maxlength="200"
      autocomplete="off"
    />
    <DateInput
      v-model="endDate"
      label="Data de término"
      hint="Opcional. Só destaca quando passa sem concluir: não gera atraso nem pontos."
      :error="endDateError"
    />
    <BaseTextarea v-model="notes" label="Notas" :error="notesError" :maxlength="2000" />

    <div class="flex justify-end gap-2 pt-2">
      <BaseButton variant="outline" :disabled="saving" @click="emit('cancel')">Cancelar</BaseButton>
      <BaseButton type="submit" :loading="saving">
        {{ isEditing ? 'Salvar alterações' : 'Criar Super task' }}
      </BaseButton>
    </div>
  </form>
</template>
