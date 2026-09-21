import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const CHAVE = 'fc:pasta-relatorios'

let setItemBloqueado: ReturnType<typeof vi.fn>

interface Cenario {
  /** Valor já salvo no localStorage antes do módulo carregar. */
  salvo?: string
  /** Simula storage bloqueado (modo privativo): `setItem` sempre lança. */
  storageBloqueado?: boolean
}

/** Estado limpo + módulo recarregado: `usePreferencias` é um singleton avaliado na importação. */
async function carregarPreferencias({ salvo, storageBloqueado = false }: Cenario = {}) {
  localStorage.clear()
  if (salvo !== undefined) localStorage.setItem(CHAVE, salvo)

  if (storageBloqueado) {
    // Substitui o storage inteiro: espionar `Storage.prototype` deixa de valer no happy-dom
    // depois de um `setItem` real, o que tornaria o teste vacuoso.
    setItemBloqueado = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    vi.stubGlobal('localStorage', {
      getItem: (chave: string) => (chave === CHAVE ? (salvo ?? null) : null),
      setItem: setItemBloqueado,
    })
  }

  vi.resetModules()
  const { usePreferencias } = await import('@/composables/usePreferencias')
  return { usePreferencias, ...usePreferencias() }
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
  it('sem valor salvo, pastaRelatorios é string vazia', async () => {
    const { pastaRelatorios } = await carregarPreferencias()

    expect(pastaRelatorios.value).toBe('')
  })

  it('lê o valor salvo em fc:pasta-relatorios', async () => {
    const { pastaRelatorios } = await carregarPreferencias({ salvo: 'C:/Relatorios' })

    expect(pastaRelatorios.value).toBe('C:/Relatorios')
  })

  it('valor salvo vazio continua vazio', async () => {
    const { pastaRelatorios } = await carregarPreferencias({ salvo: '' })

    expect(pastaRelatorios.value).toBe('')
  })
})

describe('definirPastaRelatorios', () => {
  it('atualiza o estado e grava no localStorage', async () => {
    const { pastaRelatorios, definirPastaRelatorios } = await carregarPreferencias()

    definirPastaRelatorios('x')

    expect(pastaRelatorios.value).toBe('x')
    expect(localStorage.getItem(CHAVE)).toBe('x')
  })

  it('substitui um valor salvo anteriormente', async () => {
    const { pastaRelatorios, definirPastaRelatorios } = await carregarPreferencias({ salvo: 'antiga' })

    definirPastaRelatorios('nova')

    expect(pastaRelatorios.value).toBe('nova')
    expect(localStorage.getItem(CHAVE)).toBe('nova')
  })

  it('aceita limpar a preferência com string vazia', async () => {
    const { pastaRelatorios, definirPastaRelatorios } = await carregarPreferencias({ salvo: 'algo' })

    definirPastaRelatorios('')

    expect(pastaRelatorios.value).toBe('')
    expect(localStorage.getItem(CHAVE)).toBe('')
  })

  it('a preferência gravada sobrevive a um reload (novo módulo lê o storage)', async () => {
    const primeiro = await carregarPreferencias()
    primeiro.definirPastaRelatorios('D:/Docs')
    const valorGravado = localStorage.getItem(CHAVE)

    vi.resetModules()
    const { usePreferencias } = await import('@/composables/usePreferencias')

    expect(valorGravado).toBe('D:/Docs')
    expect(usePreferencias().pastaRelatorios.value).toBe('D:/Docs')
  })
})

describe('localStorage bloqueado', () => {
  it('setItem lançando erro atualiza o estado sem exceção', async () => {
    const { pastaRelatorios, definirPastaRelatorios } = await carregarPreferencias({ storageBloqueado: true })

    expect(() => definirPastaRelatorios('x')).not.toThrow()

    // O módulo tentou gravar e o erro foi absorvido; o estado da sessão segue válido.
    expect(setItemBloqueado).toHaveBeenCalledTimes(1)
    expect(setItemBloqueado).toHaveBeenCalledWith(CHAVE, 'x')
    expect(pastaRelatorios.value).toBe('x')
  })

  it('continua funcionando em chamadas seguidas', async () => {
    const { pastaRelatorios, definirPastaRelatorios } = await carregarPreferencias({ storageBloqueado: true })

    definirPastaRelatorios('a')
    definirPastaRelatorios('b')

    expect(setItemBloqueado).toHaveBeenCalledTimes(2)
    expect(pastaRelatorios.value).toBe('b')
  })

  it('ainda lê o valor inicial do storage bloqueado para escrita', async () => {
    const { pastaRelatorios } = await carregarPreferencias({ salvo: 'inicial', storageBloqueado: true })

    expect(pastaRelatorios.value).toBe('inicial')
  })
})

describe('valor somente leitura', () => {
  it('atribuição direta não altera o estado', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { pastaRelatorios } = await carregarPreferencias({ salvo: 'original' })

    ;(pastaRelatorios as { value: string }).value = 'alterado por fora'

    expect(pastaRelatorios.value).toBe('original')
    expect(aviso).toHaveBeenCalled()
    expect(localStorage.getItem(CHAVE)).toBe('original')
  })

  it('só definirPastaRelatorios muda o valor', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { pastaRelatorios, definirPastaRelatorios } = await carregarPreferencias()

    ;(pastaRelatorios as { value: string }).value = 'tentativa'
    definirPastaRelatorios('valida')

    expect(pastaRelatorios.value).toBe('valida')
  })
})

describe('estado singleton', () => {
  it('vários consumidores de usePreferencias veem a mesma preferência', async () => {
    const { usePreferencias, definirPastaRelatorios } = await carregarPreferencias()
    const outro = usePreferencias()

    definirPastaRelatorios('compartilhada')

    expect(outro.pastaRelatorios.value).toBe('compartilhada')
  })

  it('um consumidor definindo o valor é refletido nos demais', async () => {
    const { usePreferencias } = await carregarPreferencias()
    const a = usePreferencias()
    const b = usePreferencias()

    b.definirPastaRelatorios('via b')

    expect(a.pastaRelatorios.value).toBe('via b')
  })

  it('não vaza estado entre testes: um módulo novo lê o storage de novo', async () => {
    const primeiro = await carregarPreferencias()
    primeiro.definirPastaRelatorios('vazando?')

    const segundo = await carregarPreferencias()

    expect(segundo.pastaRelatorios.value).toBe('')
  })
})
