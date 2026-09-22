import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const CHAVE = 'fc:theme'
const html = document.documentElement

let matchMedia: ReturnType<typeof vi.fn>
let setItemBloqueado: ReturnType<typeof vi.fn>

interface Cenario {
  /** Valor já salvo no localStorage antes do módulo carregar. */
  salvo?: string
  /** Resultado de `prefers-color-scheme: dark`. */
  sistemaEscuro?: boolean
  /** Simula storage bloqueado (modo privativo): `setItem` lança a partir da importação. */
  storageBloqueado?: boolean
}

/** Estado limpo + módulo recarregado: `useTheme` é um singleton avaliado na importação. */
async function carregarTema({ salvo, sistemaEscuro = false, storageBloqueado = false }: Cenario = {}) {
  localStorage.clear()
  if (salvo !== undefined) localStorage.setItem(CHAVE, salvo)

  matchMedia = vi.fn((consulta: string) => ({ matches: sistemaEscuro, media: consulta }))
  window.matchMedia = matchMedia as unknown as typeof window.matchMedia

  if (storageBloqueado) {
    // Substitui o storage inteiro: espionar `Storage.prototype` deixa de valer no happy-dom
    // depois de um `setItem` real, o que tornaria o teste vacuoso.
    setItemBloqueado = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: setItemBloqueado })
  }

  vi.resetModules()
  const { useTheme } = await import('@/composables/useTheme')
  return { useTheme, ...useTheme() }
}

beforeEach(() => {
  html.classList.remove('dark')
  html.style.colorScheme = ''
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  html.classList.remove('dark')
  html.style.colorScheme = ''
  localStorage.clear()
})

describe('tema inicial sem valor salvo', () => {
  it('segue prefers-color-scheme escuro', async () => {
    const { tema } = await carregarTema({ sistemaEscuro: true })

    expect(tema.value).toBe('dark')
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
  })

  it('segue prefers-color-scheme claro', async () => {
    const { tema } = await carregarTema({ sistemaEscuro: false })

    expect(tema.value).toBe('light')
  })
})

describe('valor salvo', () => {
  it('"dark" prevalece sobre o sistema claro', async () => {
    const { tema } = await carregarTema({ salvo: 'dark', sistemaEscuro: false })

    expect(tema.value).toBe('dark')
  })

  it('"light" prevalece sobre o sistema escuro', async () => {
    const { tema } = await carregarTema({ salvo: 'light', sistemaEscuro: true })

    expect(tema.value).toBe('light')
  })

  it.each([
    ['azul', true, 'dark'],
    ['azul', false, 'light'],
    ['', true, 'dark'],
    ['DARK', false, 'light'],
  ] as const)('valor inválido %j é ignorado e segue o sistema (escuro: %s)', async (salvo, sistemaEscuro, esperado) => {
    const { tema } = await carregarTema({ salvo, sistemaEscuro })

    expect(tema.value).toBe(esperado)
  })
})

describe('aplicação ao carregar o módulo', () => {
  it('aplica a classe dark e o colorScheme no <html> logo na importação', async () => {
    await carregarTema({ salvo: 'dark' })

    expect(html.classList.contains('dark')).toBe(true)
    expect(html.style.colorScheme).toBe('dark')
  })

  it('tema claro não deixa a classe dark no <html>', async () => {
    html.classList.add('dark')

    await carregarTema({ salvo: 'light' })

    expect(html.classList.contains('dark')).toBe(false)
    expect(html.style.colorScheme).toBe('light')
  })

  it('persiste o tema resolvido a partir do sistema', async () => {
    await carregarTema({ sistemaEscuro: true })

    expect(localStorage.getItem(CHAVE)).toBe('dark')
    expect(html.classList.contains('dark')).toBe(true)
  })
})

describe('definirTema', () => {
  it('dark adiciona a classe, define colorScheme e grava fc:theme', async () => {
    const { tema, definirTema } = await carregarTema({ salvo: 'light' })

    definirTema('dark')

    expect(tema.value).toBe('dark')
    expect(html.classList.contains('dark')).toBe(true)
    expect(html.style.colorScheme).toBe('dark')
    expect(localStorage.getItem(CHAVE)).toBe('dark')
  })

  it('light remove a classe, define colorScheme e grava fc:theme', async () => {
    const { tema, definirTema } = await carregarTema({ salvo: 'dark' })

    definirTema('light')

    expect(tema.value).toBe('light')
    expect(html.classList.contains('dark')).toBe(false)
    expect(html.style.colorScheme).toBe('light')
    expect(localStorage.getItem(CHAVE)).toBe('light')
  })

  it('a classe no <html> sempre reflete o estado', async () => {
    const { tema, definirTema } = await carregarTema({ salvo: 'light' })

    for (const valor of ['dark', 'dark', 'light', 'dark', 'light'] as const) {
      definirTema(valor)
      expect(html.classList.contains('dark')).toBe(tema.value === 'dark')
    }
  })
})

describe('alternarTema', () => {
  it('alterna entre claro e escuro', async () => {
    const { tema, alternarTema } = await carregarTema({ salvo: 'light' })

    alternarTema()
    expect(tema.value).toBe('dark')
    expect(html.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(CHAVE)).toBe('dark')

    alternarTema()
    expect(tema.value).toBe('light')
    expect(html.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem(CHAVE)).toBe('light')
  })
})

describe('estado singleton', () => {
  it('várias chamadas de useTheme compartilham o mesmo tema', async () => {
    const { useTheme, definirTema } = await carregarTema({ salvo: 'light' })
    const outro = useTheme()

    definirTema('dark')

    expect(outro.tema.value).toBe('dark')
  })

  it('não vaza estado entre testes: um módulo novo lê o storage de novo', async () => {
    const primeiro = await carregarTema({ salvo: 'light' })
    primeiro.definirTema('dark')

    const segundo = await carregarTema({ salvo: 'light' })

    expect(segundo.tema.value).toBe('light')
    expect(html.classList.contains('dark')).toBe(false)
  })
})

describe('localStorage bloqueado', () => {
  it('setItem lançando erro não quebra o carregamento nem definirTema, e o tema segue aplicado', async () => {
    const { tema, definirTema, alternarTema } = await carregarTema({
      sistemaEscuro: true,
      storageBloqueado: true,
    })
    // O módulo tentou gravar no carregamento e o erro foi absorvido.
    expect(setItemBloqueado).toHaveBeenCalledTimes(1)
    expect(tema.value).toBe('dark')
    expect(html.classList.contains('dark')).toBe(true)

    expect(() => definirTema('light')).not.toThrow()
    expect(setItemBloqueado).toHaveBeenCalledTimes(2)
    expect(tema.value).toBe('light')
    expect(html.classList.contains('dark')).toBe(false)
    expect(html.style.colorScheme).toBe('light')

    expect(() => alternarTema()).not.toThrow()
    expect(tema.value).toBe('dark')
    expect(html.classList.contains('dark')).toBe(true)
  })
})
