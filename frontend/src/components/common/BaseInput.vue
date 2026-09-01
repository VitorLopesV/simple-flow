<script setup lang="ts">
import { computed, useId } from 'vue'

import { cn } from '@/utils/cn'

// Listeners e atributos extras (@blur, autocomplete...) vão para o <input>,
// não para o wrapper.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    label?: string
    tipo?: string
    placeholder?: string
    erro?: string
    dica?: string
    obrigatorio?: boolean
    desabilitado?: boolean
    /** Alinha o texto à direita — usado em campos de valor. */
    alinharDireita?: boolean
    inputmode?: 'text' | 'decimal' | 'numeric' | 'search'
    max?: string | number
    min?: string | number
    maxlength?: number
  }>(),
  {
    label: '',
    tipo: 'text',
    placeholder: '',
    erro: '',
    dica: '',
    obrigatorio: false,
    desabilitado: false,
    alinharDireita: false,
    inputmode: 'text',
  },
)

const modelo = defineModel<string | number | null>({ default: '' })

const id = useId()
const idErro = computed(() => `${id}-erro`)
const idDica = computed(() => `${id}-dica`)

const descritoPor = computed(() => {
  const partes: string[] = []
  if (props.erro) partes.push(idErro.value)
  if (props.dica) partes.push(idDica.value)
  return partes.length ? partes.join(' ') : undefined
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="id" class="text-sm font-medium">
      {{ label }}
      <span v-if="obrigatorio" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <span
        v-if="$slots.prefixo"
        class="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm"
      >
        <slot name="prefixo" />
      </span>

      <input
        :id="id"
        v-bind="$attrs"
        v-model="modelo"
        :type="tipo"
        :placeholder="placeholder"
        :disabled="desabilitado"
        :required="obrigatorio"
        :inputmode="inputmode"
        :max="max"
        :min="min"
        :maxlength="maxlength"
        :aria-invalid="Boolean(erro) || undefined"
        :aria-describedby="descritoPor"
        :class="
          cn(
            'bg-card border-input h-10 w-full rounded-lg border px-3 text-sm transition-colors',
            'placeholder:text-muted-foreground/70',
            'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30',
            'disabled:cursor-not-allowed disabled:opacity-60',
            $slots.prefixo && 'pl-10',
            $slots.sufixo && 'pr-10',
            alinharDireita && 'text-right numero-tabular',
            erro && 'border-danger focus:border-danger focus:ring-danger/30',
          )
        "
      />

      <span v-if="$slots.sufixo" class="absolute inset-y-0 right-1.5 flex items-center">
        <slot name="sufixo" />
      </span>
    </div>

    <p v-if="erro" :id="idErro" class="text-danger text-xs" role="alert">{{ erro }}</p>
    <p v-else-if="dica" :id="idDica" class="text-muted-foreground text-xs">{{ dica }}</p>
  </div>
</template>
