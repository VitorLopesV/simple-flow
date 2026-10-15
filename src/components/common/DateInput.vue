<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { cn } from '@/utils/cn'
import { MONTHS, brDateToISO, maskBrDate, toBrDateMask, toDate, toISODate } from '@/utils/dateFormatter'
import BaseButton from './BaseButton.vue'
import BaseInput from './BaseInput.vue'

const props = withDefaults(
  defineProps<{
    label?: string
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
  }>(),
  { label: 'Data', error: '', hint: '', required: false, disabled: false },
)

/** O modelo é sempre ISO (`aaaa-mm-dd`); a máscara dd/mm/aaaa vive apenas no texto exibido. */
const model = defineModel<string>({ default: '' })

const emit = defineEmits<{ blur: [] }>()

const text = ref(toBrDateMask(model.value))
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const todayISO = toISODate(new Date())

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function periodOf(iso: string): { month: number; year: number } {
  const date = toDate(iso)
  return { month: date.getMonth() + 1, year: date.getFullYear() }
}

const displayedMonth = ref(periodOf(model.value || todayISO))

// Sincroniza quando o valor muda por fora (ex.: abrir o form em modo edição).
watch(model, (value) => {
  if (brDateToISO(text.value) !== value) text.value = toBrDateMask(value)
})

watch(text, (value) => {
  const masked = maskBrDate(value)
  if (masked !== value) {
    text.value = masked
    return
  }
  // Campo apagado por completo: limpa o modelo também (relevante para campos
  // opcionais como "Data de vencimento" — sem isso o valor anterior ficava
  // "preso" no v-model mesmo com o texto visível vazio).
  if (!masked) {
    model.value = ''
    return
  }
  const iso = brDateToISO(masked)
  if (iso) model.value = iso
})

// Um campo desabilitado (ex.: lançamento recorrente) nunca deve manter o calendário aberto.
watch(
  () => props.disabled,
  (value) => {
    if (value) open.value = false
  },
)

const monthDays = computed(() => {
  const { month, year } = displayedMonth.value
  const monthStart = new Date(year, month - 1, 1)
  const gridStart = new Date(year, month - 1, 1 - monthStart.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return {
      day: date.getDate(),
      iso: toISODate(date),
      outsideMonth: date.getMonth() !== month - 1,
    }
  })
})

function moveMonth(amount: number): void {
  const date = new Date(displayedMonth.value.year, displayedMonth.value.month - 1 + amount, 1)
  displayedMonth.value = { month: date.getMonth() + 1, year: date.getFullYear() }
}

function toggleCalendar(): void {
  if (props.disabled) return
  if (!open.value) displayedMonth.value = periodOf(model.value || todayISO)
  open.value = !open.value
}

function selectDay(iso: string): void {
  model.value = iso
  open.value = false
}

function onClickOutside(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

watch(open, (value) => {
  if (value) document.addEventListener('mousedown', onClickOutside)
  else document.removeEventListener('mousedown', onClickOutside)
})

onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="root" class="relative" @keydown.escape="open = false">
    <BaseInput
      v-model="text"
      :label="label"
      placeholder="dd/mm/aaaa"
      :error="error"
      :hint="hint"
      :required="required"
      :disabled="disabled"
      inputmode="numeric"
      :maxlength="10"
      autocomplete="off"
      @blur="emit('blur')"
    >
      <template #suffix>
        <button
          type="button"
          class="text-muted-foreground hover:bg-success/25 hover:text-foreground focus-visible:outline-ring flex size-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2"
          :disabled="disabled"
          aria-haspopup="dialog"
          :aria-expanded="open"
          aria-label="Abrir calendário"
          @click="toggleCalendar"
        >
          <CalendarDays class="size-4" aria-hidden="true" />
        </button>
      </template>
    </BaseInput>

    <div
      v-if="open"
      role="dialog"
      aria-label="Selecionar data"
      class="bg-card border-border absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border p-3 shadow-lg"
    >
      <div class="mb-2 flex items-center justify-between">
        <BaseButton variant="ghost" size="icon" aria-label="Mês anterior" @click="moveMonth(-1)">
          <ChevronLeft class="size-4" aria-hidden="true" />
        </BaseButton>
        <p class="text-sm font-medium">{{ MONTHS[displayedMonth.month - 1] }} de {{ displayedMonth.year }}</p>
        <BaseButton variant="ghost" size="icon" aria-label="Próximo mês" @click="moveMonth(1)">
          <ChevronRight class="size-4" aria-hidden="true" />
        </BaseButton>
      </div>

      <div class="grid grid-cols-7 gap-1 text-center">
        <span
          v-for="weekday in WEEKDAYS"
          :key="weekday"
          class="text-muted-foreground py-1 text-xs font-medium"
        >
          {{ weekday }}
        </span>
        <button
          v-for="cell in monthDays"
          :key="cell.iso"
          type="button"
          :class="
            cn(
              'flex h-8 items-center justify-center rounded-md text-sm transition-colors',
              cell.outsideMonth ? 'text-muted-foreground/40' : 'text-foreground',
              cell.iso === model
                ? 'bg-primary text-primary-foreground font-medium'
                : 'hover:bg-success/25',
              cell.iso === todayISO && cell.iso !== model && 'ring-ring ring-1',
            )
          "
          @click="selectDay(cell.iso)"
        >
          {{ cell.day }}
        </button>
      </div>
    </div>
  </div>
</template>
