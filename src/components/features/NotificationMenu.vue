<script setup lang="ts">
import { CircleCheck, Clock, ListChecks, TriangleAlert, Trophy } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import notificationsIcon from '@/img/notifications_icon.svg'
import type { AppNotification } from '@/types/notification'
import { formatDate } from '@/utils/dateFormatter'

const props = withDefaults(
  defineProps<{
    notifications: AppNotification[]
    /** Ids já vistos: só os novos entram no contador do sino. */
    seenIds?: string[]
    loading?: boolean
    error?: string | null
  }>(),
  { seenIds: () => [], loading: false, error: null },
)

const emit = defineEmits<{
  /** O popup abriu: quem controla os dados pode recarregar os alertas. */
  open: []
  /** Ids exibidos ao abrir, para virarem "vistos". */
  seen: [ids: string[]]
  retry: []
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const popup = ref<HTMLElement | null>(null)
const trigger = ref<InstanceType<typeof BaseButton> | null>(null)

const id = useId()
const popupId = `${id}-popup`
const titleId = `${id}-title`
const contentId = `${id}-content`

/** Total na lista (cabeçalho do popup) e novos (badge do sino e nome acessível). */
const count = computed(() => props.notifications.length)
const unseen = computed(() => props.notifications.filter((item) => !props.seenIds.includes(item.id)).length)
const countLabel = computed(() => `${count.value} ${count.value === 1 ? 'alerta' : 'alertas'}`)
const triggerLabel = computed(() => {
  if (!unseen.value) return 'Notificações'
  return `Notificações: ${unseen.value} ${unseen.value === 1 ? 'alerta novo' : 'alertas novos'}`
})

/** Alertas que eram novos quando o popup abriu: ficam destacados até ele fechar, mesmo já marcados como vistos. */
const highlighted = ref<string[]>([])

const KIND_ICON = { TAREFA_ATRASADA: Clock, ROTINA_INCOMPLETA: ListChecks, RESULTADO_SPRINT: Trophy } as const
function iconFor(kind: string | undefined) {
  return KIND_ICON[kind as keyof typeof KIND_ICON] ?? null
}

/** O `url()` precisa de aspas: o Vite embute o SVG como `data:` URL com espaços, que quebram o CSS sem elas. */
const iconMask = `url("${notificationsIcon}") center / contain no-repeat`
const iconMaskStyle = { mask: iconMask, WebkitMask: iconMask }

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
    highlighted.value = props.notifications.filter((item) => !props.seenIds.includes(item.id)).map((item) => item.id)
    emit('open')
    emit('seen', props.notifications.map((item) => item.id))
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
  <div ref="root" class="relative flex h-14 items-center justify-center" @focusout="closeOnFocusOut">
    <BaseButton
      ref="trigger"
      variant="ghost"
      size="icon"
      class="relative !size-10 !p-0 !text-[#D1D1D1] !transition !duration-200 hover:!bg-transparent hover:!text-success hover:drop-shadow-[0_0_10px_var(--success)] focus-visible:!text-success focus-visible:drop-shadow-[0_0_10px_var(--success)] motion-safe:hover:scale-105 motion-safe:focus-visible:scale-105 motion-safe:active:scale-95"
      :class="open && '!text-success'"
      :aria-label="triggerLabel"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="popupId"
      @click="open = !open"
    >
      <!-- O sino preenche toda a caixa do SVG, então 31px de caixa são 31px visíveis (o avatar tem 56px). -->
      <!-- O SVG vira máscara para herdar a cor do botão (`currentColor`), já que o arquivo tem fill fixo; assim o hover/foco/aberto trocam a cor do sino. -->
      <span
        data-testid="notification-icon"
        class="size-[31px] bg-current"
        :style="iconMaskStyle"
        aria-hidden="true"
      ></span>
      <span
        v-if="unseen"
        data-testid="notification-badge"
        class="bg-danger text-danger-foreground ring-background tabular-number absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold ring-2"
        aria-hidden="true"
      >
        {{ unseen > 9 ? '9+' : unseen }}
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
      class="border-border bg-background fixed inset-x-4 top-[4.5rem] z-50 rounded-lg border shadow-lg outline-none sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-0 sm:w-[31.2rem]"
    >
      <div class="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 :id="titleId" class="text-foreground text-sm font-semibold">Notificações</h2>
        <span v-if="count" class="text-muted-foreground text-xs">{{ countLabel }}</span>
      </div>

      <div :id="contentId">
        <div v-if="loading && !count" data-testid="notifications-loading" class="px-4 py-6">
          <BaseSkeleton :lines="3" height="h-8" />
        </div>

        <div v-else-if="error && !count" data-testid="notifications-error" class="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span class="bg-danger-soft text-danger rounded-full p-3">
            <TriangleAlert class="size-5" aria-hidden="true" />
          </span>
          <p class="text-foreground text-sm font-medium" role="alert">{{ error }}</p>
          <BaseButton size="sm" variant="outline" data-testid="notifications-retry" @click="emit('retry')">
            Tentar de novo
          </BaseButton>
        </div>

        <ul v-else-if="count" class="thin-scroll divide-border max-h-[min(51.75rem,90vh)] divide-y overflow-y-auto">
          <li
            v-for="notification in notifications"
            :key="notification.id"
            data-testid="notification-item"
            class="px-4 py-3"
            :class="highlighted.includes(notification.id) && 'bg-primary/5'"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="text-foreground flex min-w-0 items-center gap-2 text-sm font-medium wrap-break-word">
                <component :is="iconFor(notification.kind)" v-if="iconFor(notification.kind)" class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                <span v-if="highlighted.includes(notification.id)" class="sr-only">Novo: </span>
                {{ notification.title }}
              </p>
              <time :datetime="notification.date" class="text-muted-foreground tabular-number shrink-0 text-xs">
                {{ formatDate(notification.date) }}
              </time>
            </div>
            <p class="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{{ notification.description }}</p>
          </li>
        </ul>

        <div v-else data-testid="notifications-empty" class="flex flex-col items-center gap-2 px-6 py-28 text-center">
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
