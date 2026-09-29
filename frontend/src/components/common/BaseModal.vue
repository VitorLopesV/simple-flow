<script setup lang="ts">
import { X } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import BaseButton from './BaseButton.vue'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    width?: 'sm' | 'md' | 'lg'
  }>(),
  { description: '', width: 'md' },
)

const open = defineModel<boolean>('open', { default: false })

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const

const panel = ref<HTMLElement | null>(null)
const id = useId()
const titleId = computed(() => `${id}-title`)
const descriptionId = computed(() => `${id}-description`)

let previousFocus: HTMLElement | null = null

function close(): void {
  open.value = false
}

/** Mantém o Tab dentro do modal enquanto ele estiver aberto (a11y). */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
    return
  }
  if (event.key !== 'Tab' || !panel.value) return

  const focusable = panel.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
  )
  if (!focusable.length) return

  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  const active = document.activeElement

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function lockScroll(lock: boolean): void {
  document.body.style.overflow = lock ? 'hidden' : ''
}

watch(open, async (isOpen) => {
  lockScroll(isOpen)

  if (isOpen) {
    previousFocus = document.activeElement as HTMLElement | null
    await nextTick()
    const target = panel.value?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-close])',
    )
    target?.focus()
  } else {
    previousFocus?.focus()
    previousFocus = null
  }
})

onBeforeUnmount(() => lockScroll(false))
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
        v-if="open"
        class="bg-overlay fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="close"
        @keydown="onKeydown"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="description ? descriptionId : undefined"
          :class="[
            'bg-card text-card-foreground border-border max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border shadow-xl sm:rounded-2xl',
            WIDTHS[props.width],
          ]"
        >
          <header class="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <h2 :id="titleId" class="text-base font-semibold">{{ title }}</h2>
              <p v-if="description" :id="descriptionId" class="text-muted-foreground mt-0.5 text-sm">
                {{ description }}
              </p>
            </div>
            <BaseButton
              variant="ghost"
              size="icon"
              class="hover:!bg-danger/25 hover:!text-danger"
              data-close
              aria-label="Fechar"
              @click="close"
            >
              <X class="size-4" aria-hidden="true" />
            </BaseButton>
          </header>

          <div class="px-5 py-4">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="border-border bg-muted/40 border-t px-5 py-3">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
