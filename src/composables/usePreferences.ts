import { readonly, ref } from 'vue'

// O valor da chave é o já gravado nos navegadores dos usuários: mudar apagaria a preferência.
const REPORTS_FOLDER_KEY = 'fc:pasta-relatorios'

function initialValue(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(REPORTS_FOLDER_KEY) ?? ''
}

// Estado singleton: a preferência é global, não por componente.
const reportsFolder = ref<string>(initialValue())

export function usePreferences() {
  function setReportsFolder(value: string): void {
    reportsFolder.value = value
    try {
      window.localStorage.setItem(REPORTS_FOLDER_KEY, value)
    } catch {
      // Modo privativo pode bloquear o storage; a preferência segue válida na sessão.
    }
  }

  return { reportsFolder: readonly(reportsFolder), setReportsFolder }
}
