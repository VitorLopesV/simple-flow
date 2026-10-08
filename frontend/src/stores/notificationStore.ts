import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { AppNotification } from '@/types/notification'

/**
 * Alertas do usuário mostrados no sino do cabeçalho. Por enquanto a lista fica vazia:
 * a origem e as regras dos alertas serão definidas depois, e basta preencher
 * `notifications` (via service, como nos demais domínios) para o popup exibi-los.
 */
export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<AppNotification[]>([])

  const count = computed(() => notifications.value.length)

  return { notifications, count }
})
