<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseTextarea from '@/components/common/BaseTextarea.vue'
import DateInput from '@/components/common/DateInput.vue'
import type { Task, TaskDifficulty, TaskEdit, TaskEstimate, TaskPriority } from '@/types/task'
import { TASK_DIFFICULTIES, TASK_ESTIMATES, TASK_PRIORITIES } from '@/types/task'
import { cn } from '@/utils/cn'
import { compose, isoDate, maxLength, required } from '@/utils/validators'
import type { Rule } from '@/utils/validators'

interface FormValues {
  title: string
  day: string
  time: string
  estimateMinutes: TaskEstimate | null
  difficulty: TaskDifficulty | null
  priority: TaskPriority | null
  notes: string
}

const props = withDefaults(defineProps<{ task: Task; saving?: boolean }>(), { saving: false })

const emit = defineEmits<{ save: [edit: TaskEdit]; cancel: [] }>()

/** Aplica a regra só quando o campo foi preenchido: dia e hora são opcionais. */
const optional =
  (rule: Rule): Rule =>
  (value) =>
    String(value ?? '').trim() === '' ? true : rule(value)

const timeFormat: Rule = (value) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)) ? true : 'Hora inválida.')

function initialValues(): FormValues {
  return {
    title: props.task.title,
    day: props.task.day ?? '',
    time: props.task.time ?? '',
    estimateMinutes: props.task.estimateMinutes,
    difficulty: props.task.difficulty,
    priority: props.task.priority,
    notes: props.task.notes ?? '',
  }
}

const { handleSubmit, resetForm } = useForm<FormValues>({
  initialValues: initialValues(),
  validationSchema: {
    title: compose(required('Título'), maxLength(200, 'Título')),
    day: optional(isoDate('Dia')),
    time: optional(timeFormat),
    notes: maxLength(2000, 'Notas'),
  },
})

const { value: title, errorMessage: titleError } = useField<string>('title')
const { value: day, errorMessage: dayError } = useField<string>('day')
const { value: time, errorMessage: timeError } = useField<string>('time')
const { value: estimateMinutes } = useField<TaskEstimate | null>('estimateMinutes')
const { value: difficulty } = useField<TaskDifficulty | null>('difficulty')
const { value: priority } = useField<TaskPriority | null>('priority')
const { value: notes, errorMessage: notesError } = useField<string>('notes')

watch(
  () => props.task,
  () => resetForm({ values: initialValues() }),
)

/** Clicar no botão já escolhido limpa o campo, que é opcional fora do sprint. */
function toggleEstimate(value: TaskEstimate): void {
  estimateMinutes.value = estimateMinutes.value === value ? null : value
}
function toggleDifficulty(value: TaskDifficulty): void {
  difficulty.value = difficulty.value === value ? null : value
}
function togglePriority(value: TaskPriority): void {
  priority.value = priority.value === value ? null : value
}

function chipClass(active: boolean): string {
  return cn(
    'focus-visible:outline-ring cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
    active
      ? 'bg-success text-success-foreground border-transparent'
      : 'border-border text-muted-foreground hover:bg-success/25 hover:text-foreground',
  )
}

const onSubmit = handleSubmit((form) => {
  emit('save', {
    title: form.title.trim(),
    day: form.day || null,
    time: form.time || null,
    estimateMinutes: form.estimateMinutes,
    difficulty: form.difficulty,
    priority: form.priority,
    notes: form.notes.trim() || null,
  })
})
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit="onSubmit">
    <BaseInput
      v-model="title"
      label="Título"
      placeholder="Ex.: Pintar a casa nas férias"
      :error="titleError"
      required
      :maxlength="200"
      autocomplete="off"
    />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DateInput v-model="day" label="Dia" :error="dayError" />
      <BaseInput v-model="time" type="time" label="Hora" :error="timeError" />
    </div>

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1.5 text-sm font-medium">Tempo estimado</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in TASK_ESTIMATES"
          :key="option.value"
          type="button"
          :aria-pressed="estimateMinutes === option.value"
          :class="chipClass(estimateMinutes === option.value)"
          @click="toggleEstimate(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1.5 text-sm font-medium">Dificuldade</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in TASK_DIFFICULTIES"
          :key="option.value"
          type="button"
          :aria-pressed="difficulty === option.value"
          :class="chipClass(difficulty === option.value)"
          @click="toggleDifficulty(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1.5 text-sm font-medium">Prioridade</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in TASK_PRIORITIES"
          :key="option.value"
          type="button"
          :aria-pressed="priority === option.value"
          :class="chipClass(priority === option.value)"
          @click="togglePriority(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <BaseTextarea v-model="notes" label="Notas" :error="notesError" :maxlength="2000" :rows="3" />

    <div class="flex justify-end gap-2 pt-2">
      <BaseButton variant="outline" :disabled="saving" @click="emit('cancel')">Cancelar</BaseButton>
      <BaseButton type="submit" :loading="saving">Salvar alterações</BaseButton>
    </div>
  </form>
</template>
