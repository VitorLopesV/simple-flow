import { readonly, ref } from 'vue'

export type Tema = 'light' | 'dark'

const CHAVE = 'fc:theme'

function temaInicial(): Tema {
  if (typeof window === 'undefined') return 'light'
  const salvo = window.localStorage.getItem(CHAVE)
  if (salvo === 'light' || salvo === 'dark') return salvo
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Estado singleton: o tema é global, não por componente.
const tema = ref<Tema>(temaInicial())

function aplicar(valor: Tema): void {
  document.documentElement.classList.toggle('dark', valor === 'dark')
  document.documentElement.style.colorScheme = valor
  try {
    window.localStorage.setItem(CHAVE, valor)
  } catch {
    // Modo privativo pode bloquear o storage; o tema segue válido na sessão.
  }
}

export function useTheme() {
  function definirTema(valor: Tema): void {
    tema.value = valor
    aplicar(valor)
  }

  function alternarTema(): void {
    definirTema(tema.value === 'dark' ? 'light' : 'dark')
  }

  return { tema: readonly(tema), definirTema, alternarTema }
}

// Garante que a classe no <html> reflita o estado logo no carregamento do módulo.
if (typeof document !== 'undefined') aplicar(tema.value)
