<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { cn } from '@/utils/cn'
import { MESES, mascararDataBR, paraISODataBR, paraMascaraDataBR, toDate, toISODate } from '@/utils/dateFormatter'
import BaseButton from './BaseButton.vue'
import BaseInput from './BaseInput.vue'

const props = withDefaults(
  defineProps<{
    label?: string
    erro?: string
    dica?: string
    obrigatorio?: boolean
    desabilitado?: boolean
  }>(),
  { label: 'Data', erro: '', dica: '', obrigatorio: false, desabilitado: false },
)

/** O modelo é sempre ISO (`aaaa-mm-dd`); a máscara dd/mm/aaaa vive apenas no texto exibido. */
const modelo = defineModel<string>({ default: '' })

const emit = defineEmits<{ blur: [] }>()

const texto = ref(paraMascaraDataBR(modelo.value))
const aberto = ref(false)
const raiz = ref<HTMLElement | null>(null)
const hojeISO = toISODate(new Date())

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function periodoDe(iso: string): { mes: number; ano: number } {
  const data = toDate(iso)
  return { mes: data.getMonth() + 1, ano: data.getFullYear() }
}

const mesExibido = ref(periodoDe(modelo.value || hojeISO))

// Sincroniza quando o valor muda por fora (ex.: abrir o form em modo edição).
watch(modelo, (valor) => {
  if (paraISODataBR(texto.value) !== valor) texto.value = paraMascaraDataBR(valor)
})

watch(texto, (valor) => {
  const mascarada = mascararDataBR(valor)
  if (mascarada !== valor) {
    texto.value = mascarada
    return
  }
  const iso = paraISODataBR(mascarada)
  if (iso) modelo.value = iso
})

// Um campo desabilitado (ex.: lançamento recorrente) nunca deve manter o calendário aberto.
watch(
  () => props.desabilitado,
  (valor) => {
    if (valor) aberto.value = false
  },
)

const diasDoMes = computed(() => {
  const { mes, ano } = mesExibido.value
  const inicioDoMes = new Date(ano, mes - 1, 1)
  const inicioDaGrade = new Date(ano, mes - 1, 1 - inicioDoMes.getDay())

  return Array.from({ length: 42 }, (_, indice) => {
    const data = new Date(inicioDaGrade)
    data.setDate(inicioDaGrade.getDate() + indice)
    return {
      dia: data.getDate(),
      iso: toISODate(data),
      foraDoMes: data.getMonth() !== mes - 1,
    }
  })
})

function moverMes(quantidade: number): void {
  const data = new Date(mesExibido.value.ano, mesExibido.value.mes - 1 + quantidade, 1)
  mesExibido.value = { mes: data.getMonth() + 1, ano: data.getFullYear() }
}

function alternarCalendario(): void {
  if (props.desabilitado) return
  if (!aberto.value) mesExibido.value = periodoDe(modelo.value || hojeISO)
  aberto.value = !aberto.value
}

function selecionarDia(iso: string): void {
  modelo.value = iso
  aberto.value = false
}

function aoClicarFora(evento: MouseEvent): void {
  if (raiz.value && !raiz.value.contains(evento.target as Node)) aberto.value = false
}

watch(aberto, (valor) => {
  if (valor) document.addEventListener('mousedown', aoClicarFora)
  else document.removeEventListener('mousedown', aoClicarFora)
})

onBeforeUnmount(() => document.removeEventListener('mousedown', aoClicarFora))
</script>

<template>
  <div ref="raiz" class="relative" @keydown.escape="aberto = false">
    <BaseInput
      v-model="texto"
      :label="label"
      placeholder="dd/mm/aaaa"
      :erro="erro"
      :dica="dica"
      :obrigatorio="obrigatorio"
      :desabilitado="desabilitado"
      inputmode="numeric"
      :maxlength="10"
      autocomplete="off"
      @blur="emit('blur')"
    >
      <template #sufixo>
        <button
          type="button"
          class="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-ring flex size-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2"
          :disabled="desabilitado"
          aria-haspopup="dialog"
          :aria-expanded="aberto"
          aria-label="Abrir calendário"
          @click="alternarCalendario"
        >
          <CalendarDays class="size-4" aria-hidden="true" />
        </button>
      </template>
    </BaseInput>

    <div
      v-if="aberto"
      role="dialog"
      aria-label="Selecionar data"
      class="bg-card border-border absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border p-3 shadow-lg"
    >
      <div class="mb-2 flex items-center justify-between">
        <BaseButton variante="ghost" tamanho="icon" aria-label="Mês anterior" @click="moverMes(-1)">
          <ChevronLeft class="size-4" aria-hidden="true" />
        </BaseButton>
        <p class="text-sm font-medium">{{ MESES[mesExibido.mes - 1] }} de {{ mesExibido.ano }}</p>
        <BaseButton variante="ghost" tamanho="icon" aria-label="Próximo mês" @click="moverMes(1)">
          <ChevronRight class="size-4" aria-hidden="true" />
        </BaseButton>
      </div>

      <div class="grid grid-cols-7 gap-1 text-center">
        <span
          v-for="dia in DIAS_SEMANA"
          :key="dia"
          class="text-muted-foreground py-1 text-xs font-medium"
        >
          {{ dia }}
        </span>
        <button
          v-for="celula in diasDoMes"
          :key="celula.iso"
          type="button"
          :class="
            cn(
              'flex h-8 items-center justify-center rounded-md text-sm transition-colors',
              celula.foraDoMes ? 'text-muted-foreground/40' : 'text-foreground',
              celula.iso === modelo
                ? 'bg-primary text-primary-foreground font-medium'
                : 'hover:bg-muted',
              celula.iso === hojeISO && celula.iso !== modelo && 'ring-ring ring-1',
            )
          "
          @click="selecionarDia(celula.iso)"
        >
          {{ celula.dia }}
        </button>
      </div>
    </div>
  </div>
</template>
