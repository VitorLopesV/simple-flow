<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import type { Periodo } from '@/types/common'
import { addMeses, MESES, mesmoPeriodo, periodoAtual } from '@/utils/dateFormatter'

const props = withDefaults(defineProps<{ anosDisponiveis?: number }>(), { anosDisponiveis: 5 })

const modelo = defineModel<Periodo>({ required: true })
const emit = defineEmits<{ hoje: [] }>()

const hoje = periodoAtual()

const anos = computed(() => {
  const inicio = hoje.ano - props.anosDisponiveis + 1
  return Array.from({ length: props.anosDisponiveis + 1 }, (_, i) => inicio + i)
})

const ehMesAtual = computed(() => mesmoPeriodo(modelo.value, hoje))

function mover(quantidade: number): void {
  modelo.value = addMeses(modelo.value, quantidade)
}

function definirMes(evento: Event): void {
  modelo.value = { ...modelo.value, mes: Number((evento.target as HTMLSelectElement).value) }
}

function definirAno(evento: Event): void {
  modelo.value = { ...modelo.value, ano: Number((evento.target as HTMLSelectElement).value) }
}
</script>

<template>
  <div
    class="bg-card border-border flex items-center gap-1 rounded-lg border p-1"
    role="group"
    aria-label="Selecionar período"
  >
    <BaseButton variante="ghost" tamanho="icon" aria-label="Mês anterior" @click="mover(-1)">
      <ChevronLeft class="size-4" aria-hidden="true" />
    </BaseButton>

    <div class="flex items-center gap-1">
      <label class="sr-only" for="seletor-mes">Mês</label>
      <select
        id="seletor-mes"
        class="focus-visible:outline-ring [color-scheme:dark] cursor-pointer rounded-md bg-transparent px-1 py-1 text-sm font-medium focus-visible:outline-2"
        :value="modelo.mes"
        @change="definirMes"
      >
        <option
          v-for="(nome, indice) in MESES"
          :key="nome"
          :value="indice + 1"
          class="bg-slate-800 text-white"
        >
          {{ nome }}
        </option>
      </select>

      <label class="sr-only" for="seletor-ano">Ano</label>
      <select
        id="seletor-ano"
        class="focus-visible:outline-ring [color-scheme:dark] cursor-pointer rounded-md bg-transparent px-1 py-1 text-sm font-medium focus-visible:outline-2"
        :value="modelo.ano"
        @change="definirAno"
      >
        <option v-for="ano in anos" :key="ano" :value="ano" class="bg-slate-800 text-white">
          {{ ano }}
        </option>
      </select>
    </div>

    <BaseButton variante="ghost" tamanho="icon" aria-label="Próximo mês" @click="mover(1)">
      <ChevronRight class="size-4" aria-hidden="true" />
    </BaseButton>

    <BaseButton
      v-if="!ehMesAtual"
      variante="ghost"
      tamanho="sm"
      title="Voltar para o mês atual"
      @click="emit('hoje')"
    >
      <CalendarDays class="size-3.5" aria-hidden="true" />
      Hoje
    </BaseButton>
  </div>
</template>
