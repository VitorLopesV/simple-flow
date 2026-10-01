<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import type { Period } from '@/types/common'
import {
  addMonths,
  clampPeriod,
  comparePeriods,
  currentPeriod,
  isSamePeriod,
  MONTHS,
} from '@/utils/dateFormatter'

const props = withDefaults(
  defineProps<{
    availableYears?: number
    /** Primeiro mês navegável; ausente = sem limite no passado (além de `availableYears`). */
    min?: Period | null
    /** Último mês navegável; ausente = sem limite no futuro (além de `availableYears`). */
    max?: Period | null
  }>(),
  { availableYears: 5, min: null, max: null },
)

const model = defineModel<Period>({ required: true })
const emit = defineEmits<{ today: [] }>()

const today = currentPeriod()

const years = computed(() => {
  const start = props.min?.year ?? today.year - props.availableYears + 1
  const end = props.max?.year ?? today.year + 1
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i)
})

const isCurrentMonth = computed(() => isSamePeriod(model.value, today))

const canGoBack = computed(() => !props.min || comparePeriods(model.value, props.min) > 0)
const canGoForward = computed(() => !props.max || comparePeriods(model.value, props.max) < 0)

/** Mês fora do intervalo no ano selecionado: aparece na lista, mas não pode ser escolhido. */
function isMonthOutOfRange(month: number): boolean {
  const candidate = { month, year: model.value.year }
  return (
    (props.min !== null && comparePeriods(candidate, props.min) < 0) ||
    (props.max !== null && comparePeriods(candidate, props.max) > 0)
  )
}

function update(period: Period): void {
  model.value = clampPeriod(period, props.min, props.max)
}

function move(amount: number): void {
  update(addMonths(model.value, amount))
}

function setMonth(event: Event): void {
  update({ ...model.value, month: Number((event.target as HTMLSelectElement).value) })
}

/** Trocar o ano mantém o mês, ou o encaixa no limite mais próximo se ele ficar fora. */
function setYear(event: Event): void {
  update({ ...model.value, year: Number((event.target as HTMLSelectElement).value) })
}
</script>

<template>
  <div
    class="bg-card border-border flex h-11 items-center gap-1 rounded-lg border p-0.5"
    role="group"
    aria-label="Selecionar período"
  >
    <BaseButton
      variant="ghost"
      size="icon"
      aria-label="Mês anterior"
      :disabled="!canGoBack"
      @click="move(-1)"
    >
      <ChevronLeft class="size-4" aria-hidden="true" />
    </BaseButton>

    <div class="flex items-center gap-1">
      <label class="sr-only" for="month-select">Mês</label>
      <select
        id="month-select"
        class="focus-visible:outline-ring [color-scheme:dark] cursor-pointer rounded-md bg-transparent px-1 py-1 text-sm font-medium focus-visible:outline-2"
        :value="model.month"
        @change="setMonth"
      >
        <option
          v-for="(name, index) in MONTHS"
          :key="name"
          :value="index + 1"
          :disabled="isMonthOutOfRange(index + 1)"
          class="bg-slate-800 text-white disabled:text-slate-500"
        >
          {{ name }}
        </option>
      </select>

      <label class="sr-only" for="year-select">Ano</label>
      <select
        id="year-select"
        class="focus-visible:outline-ring [color-scheme:dark] cursor-pointer rounded-md bg-transparent px-1 py-1 text-sm font-medium focus-visible:outline-2"
        :value="model.year"
        @change="setYear"
      >
        <option v-for="year in years" :key="year" :value="year" class="bg-slate-800 text-white">
          {{ year }}
        </option>
      </select>
    </div>

    <BaseButton
      variant="ghost"
      size="icon"
      aria-label="Próximo mês"
      :disabled="!canGoForward"
      @click="move(1)"
    >
      <ChevronRight class="size-4" aria-hidden="true" />
    </BaseButton>

    <BaseButton
      v-if="!isCurrentMonth"
      variant="ghost"
      size="sm"
      title="Voltar para o mês atual"
      @click="emit('today')"
    >
      <CalendarDays class="size-3.5" aria-hidden="true" />
      Hoje
    </BaseButton>
  </div>
</template>
