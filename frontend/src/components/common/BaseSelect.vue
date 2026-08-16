<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, useId } from 'vue'

import type { OpcaoSelect } from '@/types/common'
import { cn } from '@/utils/cn'

withDefaults(
  defineProps<{
    opcoes: OpcaoSelect<string>[]
    label?: string
    placeholder?: string
    erro?: string
    dica?: string
    obrigatorio?: boolean
    desabilitado?: boolean
    /** Exibe a opção vazia (ex.: "Todas as categorias"). */
    permiteVazio?: boolean
  }>(),
  {
    label: '',
    placeholder: 'Selecione',
    erro: '',
    dica: '',
    obrigatorio: false,
    desabilitado: false,
    permiteVazio: false,
  },
)

const modelo = defineModel<string | null>({ default: null })

const id = useId()
const idErro = computed(() => `${id}-erro`)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="id" class="text-sm font-medium">
      {{ label }}
      <span v-if="obrigatorio" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <select
        :id="id"
        v-model="modelo"
        :disabled="desabilitado"
        :required="obrigatorio"
        :aria-invalid="Boolean(erro) || undefined"
        :aria-describedby="erro ? idErro : undefined"
        :class="
          cn(
            'bg-card border-input h-10 w-full appearance-none rounded-lg border pl-3 pr-9 text-sm transition-colors',
            'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30',
            'disabled:cursor-not-allowed disabled:opacity-60',
            !modelo && 'text-muted-foreground',
            erro && 'border-danger focus:border-danger focus:ring-danger/30',
          )
        "
      >
        <option v-if="permiteVazio || !modelo" :value="null">{{ placeholder }}</option>
        <option
          v-for="opcao in opcoes"
          :key="String(opcao.value)"
          :value="opcao.value"
          :disabled="opcao.disabled"
          class="text-foreground"
        >
          {{ opcao.label }}
        </option>
      </select>

      <ChevronDown
        class="text-muted-foreground pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>

    <p v-if="erro" :id="idErro" class="text-danger text-xs" role="alert">{{ erro }}</p>
    <p v-else-if="dica" class="text-muted-foreground text-xs">{{ dica }}</p>
  </div>
</template>
