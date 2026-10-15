import { computed, ref } from 'vue'

interface PendingChange {
  action: 'remove' | 'deactivate'
  description: string
  months: string[]
  /** Repete a operação barrada, agora com `{ confirm: true }`. */
  run: () => Promise<unknown>
}

/**
 * Estado do `EditedMonthsDialog` de uma página: guarda a exclusão/desativação que a API
 * barrou por haver meses seguintes alterados e a repete se o usuário confirmar. Uma
 * instância por página (não é singleton) — cada tela tem a sua operação pendente.
 */
export function useEditedMonthsConfirmation() {
  const pending = ref<PendingChange | null>(null)

  const open = computed({
    get: () => pending.value !== null,
    set: (value: boolean) => {
      if (!value) pending.value = null
    },
  })

  function ask(change: PendingChange): void {
    pending.value = change
  }

  async function confirm(): Promise<void> {
    const change = pending.value
    if (!change) return
    await change.run()
    pending.value = null
  }

  function cancel(): void {
    pending.value = null
  }

  return { pending, open, ask, confirm, cancel }
}
