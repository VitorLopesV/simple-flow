<script setup lang="ts">
import { Plus, TriangleAlert, X } from '@lucide/vue'
import { useField, useForm } from 'vee-validate'
import { computed, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import DateInput from '@/components/common/DateInput.vue'
import RoutinePreview from '@/components/features/RoutinePreview.vue'
import type { RoutineItem, RoutinePayload, RoutineRepeatMode, RoutineWeekday } from '@/types/routine'
import {
  ROUTINE_MAX_INTERVAL,
  ROUTINE_MAX_TIMES,
  ROUTINE_REPEAT_MODES,
  ROUTINE_WEEKDAYS,
} from '@/types/routine'
import { cn } from '@/utils/cn'
import { toISODate } from '@/utils/dateFormatter'
import { compose, isoDate, maxLength, numberBetween, required } from '@/utils/validators'
import type { Rule } from '@/utils/validators'

interface FormValues {
  name: string
  mode: RoutineRepeatMode
  days: RoutineWeekday[]
  interval: string
  startDate: string
  /** `HH:MM` ou vazio (vez sem hora). */
  times: string[]
}

const props = withDefaults(defineProps<{ item?: RoutineItem | null; saving?: boolean }>(), {
  item: null,
  saving: false,
})

const emit = defineEmits<{ save: [payload: RoutinePayload]; cancel: [] }>()

const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/

function initialValues(): FormValues {
  const item = props.item
  return {
    name: item?.name ?? '',
    mode: item?.repeat.mode ?? 'DIAS_DA_SEMANA',
    days: item?.repeat.mode === 'DIAS_DA_SEMANA' ? [...item.repeat.days] : [],
    interval: item?.repeat.mode === 'A_CADA_N_DIAS' ? String(item.repeat.interval) : '1',
    startDate: item?.repeat.mode === 'A_CADA_N_DIAS' ? item.repeat.startDate : toISODate(new Date()),
    times: item ? item.times.map((slot) => slot.time ?? '') : [''],
  }
}

// O modo escolhido decide quais campos de repetição são exigidos; as regras o leem daqui.
const currentMode = ref<RoutineRepeatMode>(initialValues().mode)

/** Aplica a regra só no modo em que o campo existe. */
const onlyIn =
  (mode: RoutineRepeatMode, rule: Rule): Rule =>
  (value) =>
    currentMode.value === mode ? rule(value) : true

const daysRule: Rule = (value) =>
  Array.isArray(value) && value.length > 0 ? true : 'Marque ao menos um dia da semana.'

const timesRule: Rule = (value) => {
  const times = Array.isArray(value) ? (value as string[]) : []
  if (times.length < 1) return 'Informe ao menos uma vez por dia.'
  if (times.length > ROUTINE_MAX_TIMES) return `Use no máximo ${ROUTINE_MAX_TIMES} vezes por dia.`
  if (times.some((time) => time !== '' && !TIME_FORMAT.test(time))) return 'Há uma hora inválida.'
  if (new Set(times).size !== times.length) return 'Há vezes repetidas no mesmo dia.'
  return true
}

const { handleSubmit, resetForm, setErrors } = useForm<FormValues>({
  initialValues: initialValues(),
  validationSchema: {
    name: compose(required('Nome'), maxLength(200, 'Nome')),
    days: onlyIn('DIAS_DA_SEMANA', daysRule),
    interval: onlyIn('A_CADA_N_DIAS', numberBetween(1, ROUTINE_MAX_INTERVAL, 'Intervalo')),
    startDate: onlyIn('A_CADA_N_DIAS', isoDate('Data inicial')),
    times: timesRule,
  },
})

const { value: name, errorMessage: nameError } = useField<string>('name')
const { value: mode } = useField<RoutineRepeatMode>('mode')
const { value: days, errorMessage: daysError } = useField<RoutineWeekday[]>('days')
const { value: interval, errorMessage: intervalError } = useField<string>('interval')
const { value: startDate, errorMessage: startDateError } = useField<string>('startDate')
const { value: times, errorMessage: timesError } = useField<string[]>('times')

watch(
  () => props.item,
  () => {
    resetForm({ values: initialValues() })
    currentMode.value = mode.value
  },
)

function selectMode(value: RoutineRepeatMode): void {
  mode.value = value
  currentMode.value = value
  // Erros de campos do outro modo deixam de valer.
  setErrors({ days: undefined, interval: undefined, startDate: undefined })
}

function toggleDay(day: RoutineWeekday): void {
  days.value = days.value.includes(day) ? days.value.filter((d) => d !== day) : [...days.value, day]
}

function addTime(): void {
  if (times.value.length < ROUTINE_MAX_TIMES) times.value = [...times.value, '']
}

function removeTime(index: number): void {
  times.value = times.value.filter((_, i) => i !== index)
}

function setTime(index: number, value: string | number | null): void {
  times.value = times.value.map((time, i) => (i === index ? String(value ?? '') : time))
}

function chipClass(active: boolean): string {
  return cn(
    'focus-visible:outline-ring cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
    active
      ? 'bg-success text-success-foreground border-transparent'
      : 'border-border text-muted-foreground hover:bg-success/25 hover:text-foreground',
  )
}

function buildPayload(form: FormValues): RoutinePayload {
  return {
    name: form.name.trim(),
    repeat:
      form.mode === 'DIAS_DA_SEMANA'
        ? { mode: 'DIAS_DA_SEMANA', days: [...form.days].sort((a, b) => a - b) }
        : { mode: 'A_CADA_N_DIAS', interval: Number(form.interval), startDate: form.startDate },
    times: form.times.map((time) => ({ time: time || null })),
  }
}

/** Prévia ao vivo: só aparece quando os campos já formam uma regra válida. */
const livePreview = computed<RoutinePayload | null>(() => {
  const form: FormValues = {
    name: name.value,
    mode: mode.value,
    days: days.value,
    interval: interval.value,
    startDate: startDate.value,
    times: times.value,
  }
  const valid =
    timesRule(form.times) === true &&
    (form.mode === 'DIAS_DA_SEMANA'
      ? daysRule(form.days) === true
      : numberBetween(1, ROUTINE_MAX_INTERVAL)(form.interval) === true &&
        Number.isInteger(Number(form.interval)) &&
        isoDate()(form.startDate) === true)
  return valid ? buildPayload(form) : null
})

const onSubmit = handleSubmit((form) => emit('save', buildPayload(form)))
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit="onSubmit">
    <BaseInput
      v-model="name"
      label="Nome"
      placeholder="Ex.: Tomar remédio"
      :error="nameError"
      required
      :maxlength="200"
      autocomplete="off"
    />

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1.5 text-sm font-medium">Repetição</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in ROUTINE_REPEAT_MODES"
          :key="option.value"
          type="button"
          :aria-pressed="mode === option.value"
          :class="chipClass(mode === option.value)"
          @click="selectMode(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <fieldset v-if="mode === 'DIAS_DA_SEMANA'" class="flex flex-col gap-2">
      <legend class="mb-1.5 text-sm font-medium">Dias da semana</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="weekday in ROUTINE_WEEKDAYS"
          :key="weekday.value"
          type="button"
          :aria-pressed="days.includes(weekday.value)"
          :aria-label="weekday.label"
          :class="chipClass(days.includes(weekday.value))"
          @click="toggleDay(weekday.value)"
        >
          {{ weekday.short }}
        </button>
      </div>
      <p v-if="daysError" class="text-danger text-xs" role="alert">{{ daysError }}</p>
    </fieldset>

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BaseInput
          v-model="interval"
          type="number"
          inputmode="numeric"
          label="A cada quantos dias"
          :min="1"
          :max="ROUTINE_MAX_INTERVAL"
          :error="intervalError"
          required
        />
        <DateInput v-model="startDate" label="A partir de" :error="startDateError" required />
      </div>
      <p
        class="bg-warning-soft text-warning flex items-start gap-2 rounded-md px-3 py-2 text-xs"
        data-testid="weekend-warning"
      >
        <TriangleAlert class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        As ocorrências que caírem no sábado ou no domingo viram lembretes, sem pontos.
      </p>
    </template>

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1.5 text-sm font-medium">Vezes por dia</legend>
      <ul class="flex flex-col gap-2">
        <li v-for="(time, index) in times" :key="index" class="flex items-end gap-2">
          <BaseInput
            :model-value="time"
            type="time"
            class="flex-1"
            :label="`Vez ${index + 1} (hora opcional)`"
            @update:model-value="setTime(index, $event)"
          />
          <BaseButton
            variant="ghost"
            size="icon"
            :disabled="times.length === 1"
            :aria-label="`Remover vez ${index + 1}`"
            @click="removeTime(index)"
          >
            <X class="size-4" aria-hidden="true" />
          </BaseButton>
        </li>
      </ul>
      <p v-if="timesError" class="text-danger text-xs" role="alert">{{ timesError }}</p>
      <BaseButton
        variant="outline"
        size="sm"
        class="self-start"
        :disabled="times.length >= ROUTINE_MAX_TIMES"
        @click="addTime"
      >
        <Plus class="size-4" aria-hidden="true" />
        Adicionar vez
      </BaseButton>
    </fieldset>

    <RoutinePreview v-if="livePreview" :item="livePreview" />

    <p class="text-muted-foreground text-xs" data-testid="next-sprint-notice">
      As alterações valem a partir do próximo sprint; o sprint em andamento não muda.
    </p>

    <div class="flex justify-end gap-2 pt-2">
      <BaseButton variant="outline" :disabled="saving" @click="emit('cancel')">Cancelar</BaseButton>
      <BaseButton type="submit" :loading="saving">{{ item ? 'Salvar alterações' : 'Adicionar item' }}</BaseButton>
    </div>
  </form>
</template>
