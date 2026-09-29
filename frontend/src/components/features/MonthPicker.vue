<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import type { Period } from '@/types/common'
import { addMonths, currentPeriod, isSamePeriod, MONTHS } from '@/utils/dateFormatter'

const props = withDefaults(defineProps<{ availableYears?: number }>(), { availableYears: 5 })

const model = defineModel<Period>({ required: true })
const emit = defineEmits<{ today: [] }>()

const today = currentPeriod()

const years = computed(() => {
  const start = today.year - props.availableYears + 1
  return Array.from({ length: props.availableYears + 1 }, (_, i) => start + i)
})

const isCurrentMonth = computed(() => isSamePeriod(model.value, today))

function move(amount: number): void {
  model.value = addMonths(model.value, amount)
}

function setMonth(event: Event): void {
  model.value = { ...model.value, month: Number((event.target as HTMLSelectElement).value) }
}

function setYear(event: Event): void {
  model.value = { ...model.value, year: Number((event.target as HTMLSelectElement).value) }
}
</script>

<template>
  <div
    class="bg-card border-border flex h-11 items-center gap-1 rounded-lg border p-0.5"
    role="group"
    aria-label="Selecionar período"
  >
    <BaseButton variant="ghost" size="icon" aria-label="Mês anterior" @click="move(-1)">
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
          class="bg-slate-800 text-white"
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

    <BaseButton variant="ghost" size="icon" aria-label="Próximo mês" @click="move(1)">
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
