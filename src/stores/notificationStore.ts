import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/services/http'
import { notificationService } from '@/services/notificationService'
import type { AppNotification } from '@/types/notification'
import { useAuthStore } from './authStore'

/** Prefixo da chave do "já visto"; o id do usuário completa, para contas diferentes não se misturarem. */
const SEEN_KEY_PREFIX = 'simpleflow.seenAlerts'

function readSeen(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/**
 * Alertas do módulo Organização mostrados no sino (`GET /alertas`). O backend não guarda se o
 * alerta foi visto: o store guarda os ids vistos no dispositivo, e o contador do sino só conta os novos.
 * Os ids são estáveis (mesmo fato = mesmo id), então um alerta visto não volta a contar.
 */
export const useNotificationStore = defineStore('notification', () => {
  const authStore = useAuthStore()
  const seenKey = () => `${SEEN_KEY_PREFIX}.${authStore.user?.id ?? 'anonymous'}`

  const notifications = ref<AppNotification[]>([])
  const seenIds = ref<string[]>(readSeen(seenKey()))
  /** Chave com que `seenIds` foi lida: se o usuário mudou (logout/login na mesma aba), relê a do novo. */
  let seenFor = seenKey()
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Sequência da última carga: ignora respostas antigas se duas cargas se sobrepuserem. */
  let loadId = 0

  const count = computed(() => notifications.value.length)
  const unseenCount = computed(() => notifications.value.filter((item) => !seenIds.value.includes(item.id)).length)

  function persistSeen(): void {
    try {
      localStorage.setItem(seenKey(), JSON.stringify(seenIds.value))
    } catch {
      // Sem armazenamento (modo privado/cheio): o "visto" vale só enquanto a página estiver aberta.
    }
  }

  async function load(): Promise<void> {
    const current = ++loadId
    if (seenFor !== seenKey()) {
      seenFor = seenKey()
      seenIds.value = readSeen(seenFor)
      notifications.value = []
    }
    loading.value = true
    error.value = null
    try {
      const list = await notificationService.list()
      if (current !== loadId) return
      notifications.value = list
      // Descarta ids de alertas que já sumiram, para a lista guardada não crescer sem fim.
      const alive = new Set(list.map((item) => item.id))
      const pruned = seenIds.value.filter((id) => alive.has(id))
      if (pruned.length !== seenIds.value.length) {
        seenIds.value = pruned
        persistSeen()
      }
    } catch (e) {
      if (current !== loadId) return
      error.value = getErrorMessage(e, 'Não foi possível carregar os alertas.')
    } finally {
      if (current === loadId) loading.value = false
    }
  }

  /** Marca como vistos os ids informados (ao abrir o sino, todos os que estão na lista). */
  function markSeen(ids: string[]): void {
    const next = new Set(seenIds.value)
    ids.forEach((id) => next.add(id))
    if (next.size === seenIds.value.length) return
    seenIds.value = [...next]
    persistSeen()
  }

  /** Esquece tudo ao sair da conta: a lista e o "visto" são do usuário. */
  function reset(): void {
    loadId += 1
    notifications.value = []
    seenIds.value = []
    loading.value = false
    error.value = null
  }

  return { notifications, seenIds, loading, error, count, unseenCount, load, markSeen, reset }
})
