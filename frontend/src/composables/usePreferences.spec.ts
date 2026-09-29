import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'fc:pasta-relatorios'

let blockedSetItem: ReturnType<typeof vi.fn>

interface Scenario {
  /** Valor já salvo no localStorage antes do módulo carregar. */
  saved?: string
  /** Simula storage bloqueado (modo privativo): `setItem` sempre lança. */
  blockedStorage?: boolean
}

/** Estado limpo + módulo recarregado: `usePreferences` é um singleton avaliado na importação. */
async function loadPreferences({ saved, blockedStorage = false }: Scenario = {}) {
  localStorage.clear()
  if (saved !== undefined) localStorage.setItem(KEY, saved)

  if (blockedStorage) {
    // Substitui o storage inteiro: espionar `Storage.prototype` deixa de valer no happy-dom
    // depois de um `setItem` real, o que tornaria o teste vacuoso.
    blockedSetItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key === KEY ? (saved ?? null) : null),
      setItem: blockedSetItem,
    })
  }

  vi.resetModules()
  const { usePreferences } = await import('@/composables/usePreferences')
  return { usePreferences, ...usePreferences() }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('valor inicial', () => {
  it('sem valor salvo, reportsFolder é string vazia', async () => {
    const { reportsFolder } = await loadPreferences()

    expect(reportsFolder.value).toBe('')
  })

  it('lê o valor salvo em fc:pasta-relatorios', async () => {
    const { reportsFolder } = await loadPreferences({ saved: 'C:/Relatorios' })

    expect(reportsFolder.value).toBe('C:/Relatorios')
  })

  it('valor salvo vazio continua vazio', async () => {
    const { reportsFolder } = await loadPreferences({ saved: '' })

    expect(reportsFolder.value).toBe('')
  })
})

describe('setReportsFolder', () => {
  it('atualiza o estado e grava no localStorage', async () => {
    const { reportsFolder, setReportsFolder } = await loadPreferences()

    setReportsFolder('x')

    expect(reportsFolder.value).toBe('x')
    expect(localStorage.getItem(KEY)).toBe('x')
  })

  it('substitui um valor salvo anteriormente', async () => {
    const { reportsFolder, setReportsFolder } = await loadPreferences({ saved: 'antiga' })

    setReportsFolder('nova')

    expect(reportsFolder.value).toBe('nova')
    expect(localStorage.getItem(KEY)).toBe('nova')
  })

  it('aceita limpar a preferência com string vazia', async () => {
    const { reportsFolder, setReportsFolder } = await loadPreferences({ saved: 'algo' })

    setReportsFolder('')

    expect(reportsFolder.value).toBe('')
    expect(localStorage.getItem(KEY)).toBe('')
  })

  it('a preferência gravada sobrevive a um reload (novo módulo lê o storage)', async () => {
    const first = await loadPreferences()
    first.setReportsFolder('D:/Docs')
    const storedValue = localStorage.getItem(KEY)

    vi.resetModules()
    const { usePreferences } = await import('@/composables/usePreferences')

    expect(storedValue).toBe('D:/Docs')
    expect(usePreferences().reportsFolder.value).toBe('D:/Docs')
  })
})

describe('localStorage bloqueado', () => {
  it('setItem lançando erro atualiza o estado sem exceção', async () => {
    const { reportsFolder, setReportsFolder } = await loadPreferences({ blockedStorage: true })

    expect(() => setReportsFolder('x')).not.toThrow()

    // O módulo tentou gravar e o erro foi absorvido; o estado da sessão segue válido.
    expect(blockedSetItem).toHaveBeenCalledTimes(1)
    expect(blockedSetItem).toHaveBeenCalledWith(KEY, 'x')
    expect(reportsFolder.value).toBe('x')
  })

  it('continua funcionando em chamadas seguidas', async () => {
    const { reportsFolder, setReportsFolder } = await loadPreferences({ blockedStorage: true })

    setReportsFolder('a')
    setReportsFolder('b')

    expect(blockedSetItem).toHaveBeenCalledTimes(2)
    expect(reportsFolder.value).toBe('b')
  })

  it('ainda lê o valor inicial do storage bloqueado para escrita', async () => {
    const { reportsFolder } = await loadPreferences({ saved: 'inicial', blockedStorage: true })

    expect(reportsFolder.value).toBe('inicial')
  })
})

describe('valor somente leitura', () => {
  it('atribuição direta não altera o estado', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { reportsFolder } = await loadPreferences({ saved: 'original' })

    ;(reportsFolder as { value: string }).value = 'alterado por fora'

    expect(reportsFolder.value).toBe('original')
    expect(warn).toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBe('original')
  })

  it('só setReportsFolder muda o valor', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { reportsFolder, setReportsFolder } = await loadPreferences()

    ;(reportsFolder as { value: string }).value = 'tentativa'
    setReportsFolder('valida')

    expect(reportsFolder.value).toBe('valida')
  })
})

describe('estado singleton', () => {
  it('vários consumidores de usePreferences veem a mesma preferência', async () => {
    const { usePreferences, setReportsFolder } = await loadPreferences()
    const other = usePreferences()

    setReportsFolder('compartilhada')

    expect(other.reportsFolder.value).toBe('compartilhada')
  })

  it('um consumidor definindo o valor é refletido nos demais', async () => {
    const { usePreferences } = await loadPreferences()
    const a = usePreferences()
    const b = usePreferences()

    b.setReportsFolder('via b')

    expect(a.reportsFolder.value).toBe('via b')
  })

  it('não vaza estado entre testes: um módulo novo lê o storage de novo', async () => {
    const first = await loadPreferences()
    first.setReportsFolder('vazando?')

    const second = await loadPreferences()

    expect(second.reportsFolder.value).toBe('')
  })
})
