import { readonly, ref } from 'vue'

const CHAVE_PASTA_RELATORIOS = 'fc:pasta-relatorios'

function valorInicial(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(CHAVE_PASTA_RELATORIOS) ?? ''
}

// Estado singleton: a preferência é global, não por componente.
const pastaRelatorios = ref<string>(valorInicial())

export function usePreferencias() {
  function definirPastaRelatorios(valor: string): void {
    pastaRelatorios.value = valor
    try {
      window.localStorage.setItem(CHAVE_PASTA_RELATORIOS, valor)
    } catch {
      // Modo privativo pode bloquear o storage; a preferência segue válida na sessão.
    }
  }

  return { pastaRelatorios: readonly(pastaRelatorios), definirPastaRelatorios }
}
