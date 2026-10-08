<script setup lang="ts">
import { Bell, CircleCheck } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import type { AppNotification } from '@/types/notification'
import { formatDate } from '@/utils/dateFormatter'

const props = defineProps<{ notifications: AppNotification[] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const popup = ref<HTMLElement | null>(null)
const trigger = ref<InstanceType<typeof BaseButton> | null>(null)

const id = useId()
const popupId = `${id}-popup`
const titleId = `${id}-title`
const contentId = `${id}-content`

const count = computed(() => props.notifications.length)
const countLabel = computed(() => `${count.value} ${count.value === 1 ? 'alerta' : 'alertas'}`)
const triggerLabel = computed(() => (count.value ? `Notificações: ${countLabel.value}` : 'Notificações'))

/** Esc fecha e devolve o foco ao sino, para o teclado continuar de onde estava. */
function closeOnEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  open.value = false
  ;(trigger.value?.$el as HTMLElement | undefined)?.focus()
}

/**
 * Clique fora fecha. Escuta no `document` em vez de um fundo `fixed`: o `backdrop-blur`
 * do cabeçalho vira o bloco de contenção de filhos `fixed`, e um fundo assim só
 * cobriria o próprio cabeçalho.
 */
function closeOnClickOutside(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

/** Tab para fora do popup (ex.: até o menu de usuário) fecha, então os dois nunca se sobrepõem. */
function closeOnFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget as Node | null
  if (next && !root.value?.contains(next)) open.value = false
}

// Os listeners globais só existem enquanto o popup está aberto. Ao abrir, o foco vai
// para o popup, e o leitor de tela anuncia o título e o conteúdo.
watch(open, async (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', closeOnEscape)
    document.addEventListener('mousedown', closeOnClickOutside)
    await nextTick()
    popup.value?.focus()
  } else {
    window.removeEventListener('keydown', closeOnEscape)
    document.removeEventListener('mousedown', closeOnClickOutside)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', closeOnEscape)
  document.removeEventListener('mousedown', closeOnClickOutside)
})
</script>

<template>
  <div ref="root" class="relative" @focusout="closeOnFocusOut">
    <BaseButton
      ref="trigger"
      variant="ghost"
      size="icon"
      class="border-border relative !size-[56px] !rounded-full border-2 !p-0"
      :class="open && '!border-success'"
      :aria-label="triggerLabel"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="popupId"
      @click="open = !open"
    >
      <span class="bg-muted flex size-full items-center justify-center rounded-full">
        <Bell class="size-6" aria-hidden="true" />
      </span>
      <span
        v-if="count"
        data-testid="notification-badge"
        class="bg-danger text-danger-foreground ring-background tabular-number absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold ring-2"
        aria-hidden="true"
      >
        {{ count > 9 ? '9+' : count }}
      </span>
    </BaseButton>

    <!-- No celular o popup ocupa a largura da tela (menos as margens), abaixo do cabeçalho;
         a partir de `sm` fica ancorado ao sino. -->
    <div
      v-if="open"
      :id="popupId"
      ref="popup"
      role="dialog"
      :aria-labelledby="titleId"
      :aria-describedby="contentId"
      tabindex="-1"
      class="border-border bg-background fixed inset-x-4 top-[4.5rem] z-50 rounded-lg border shadow-lg outline-none sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80"
    >
      <div class="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 :id="titleId" class="text-foreground text-sm font-semibold">Notificações</h2>
        <span v-if="count" class="text-muted-foreground text-xs">{{ countLabel }}</span>
      </div>

      <div :id="contentId">
        <ul v-if="count" class="thin-scroll divide-border max-h-[min(24rem,60vh)] divide-y overflow-y-auto">
          <li
            v-for="notification in notifications"
            :key="notification.id"
            data-testid="notification-item"
            class="px-4 py-3"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="text-foreground min-w-0 text-sm font-medium wrap-break-word">{{ notification.title }}</p>
              <time :datetime="notification.date" class="text-muted-foreground tabular-number shrink-0 text-xs">
                {{ formatDate(notification.date) }}
              </time>
            </div>
            <p class="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{{ notification.description }}</p>
          </li>
        </ul>

        <div v-else data-testid="notifications-empty" class="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <span class="bg-success-soft text-success rounded-full p-3">
            <CircleCheck class="size-5" aria-hidden="true" />
          </span>
          <p class="text-foreground text-sm font-medium">Tudo em dia por aqui!</p>
          <p class="text-muted-foreground text-xs">Nenhuma notificação no momento 💚</p>
        </div>
      </div>
    </div>
  </div>
</template>
