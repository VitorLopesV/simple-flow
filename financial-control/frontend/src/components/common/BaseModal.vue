<script setup lang="ts">
import { X } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import BaseButton from './BaseButton.vue'

const props = withDefaults(
  defineProps<{
    titulo: string
    descricao?: string
    largura?: 'sm' | 'md' | 'lg'
  }>(),
  { descricao: '', largura: 'md' },
)

const aberto = defineModel<boolean>('aberto', { default: false })

const LARGURAS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const

const painel = ref<HTMLElement | null>(null)
const id = useId()
const idTitulo = computed(() => `${id}-titulo`)
const idDescricao = computed(() => `${id}-descricao`)

let focoAnterior: HTMLElement | null = null

function fechar(): void {
  aberto.value = false
}

/** Mantém o Tab dentro do modal enquanto ele estiver aberto (a11y). */
function aoPressionarTecla(evento: KeyboardEvent): void {
  if (evento.key === 'Escape') {
    evento.stopPropagation()
    fechar()
    return
  }
  if (evento.key !== 'Tab' || !painel.value) return

  const focaveis = painel.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
  )
  if (!focaveis.length) return

  const primeiro = focaveis[0]!
  const ultimo = focaveis[focaveis.length - 1]!
  const ativo = document.activeElement

  if (evento.shiftKey && ativo === primeiro) {
    evento.preventDefault()
    ultimo.focus()
  } else if (!evento.shiftKey && ativo === ultimo) {
    evento.preventDefault()
    primeiro.focus()
  }
}

function travarScroll(travar: boolean): void {
  document.body.style.overflow = travar ? 'hidden' : ''
}

watch(aberto, async (estaAberto) => {
  travarScroll(estaAberto)

  if (estaAberto) {
    focoAnterior = document.activeElement as HTMLElement | null
    await nextTick()
    const alvo = painel.value?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-fechar])',
    )
    alvo?.focus()
  } else {
    focoAnterior?.focus()
    focoAnterior = null
  }
})

onBeforeUnmount(() => travarScroll(false))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="aberto"
        class="bg-overlay fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="fechar"
        @keydown="aoPressionarTecla"
      >
        <div
          ref="painel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="idTitulo"
          :aria-describedby="descricao ? idDescricao : undefined"
          :class="[
            'bg-card text-card-foreground border-border max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border shadow-xl sm:rounded-2xl',
            LARGURAS[props.largura],
          ]"
        >
          <header class="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <h2 :id="idTitulo" class="text-base font-semibold">{{ titulo }}</h2>
              <p v-if="descricao" :id="idDescricao" class="text-muted-foreground mt-0.5 text-sm">
                {{ descricao }}
              </p>
            </div>
            <BaseButton
              variante="ghost"
              tamanho="icon"
              data-fechar
              aria-label="Fechar"
              @click="fechar"
            >
              <X class="size-4" aria-hidden="true" />
            </BaseButton>
          </header>

          <div class="px-5 py-4">
            <slot />
          </div>

          <footer v-if="$slots.rodape" class="border-border bg-muted/40 border-t px-5 py-3">
            <slot name="rodape" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
