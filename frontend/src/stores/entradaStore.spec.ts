import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { entradaService } from '@/services/entradaService'
import { useEntradaStore } from '@/stores/entradaStore'
import { usePeriodoStore } from '@/stores/periodoStore'
import type { Entrada, EntradaPayload, EntradaResumo } from '@/types/entrada'

vi.mock('@/services/entradaService', () => ({
  entradaService: {
    listar: vi.fn(),
    resumo: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    remover: vi.fn(),
  },
}))

const servico = vi.mocked(entradaService)

function entrada(id: string): Entrada {
  return {
    id,
    descricao: `Entrada ${id}`,
    valor: 100,
    data: '2026-08-05',
    categoriaId: 'cat_1',
    recorrente: false,
    criadoEm: '',
    atualizadoEm: '',
  }
}

function resumo(sobrescritas: Partial<EntradaResumo> = {}): EntradaResumo {
  return { total: 1000, quantidade: 2, media: 500, totalMesAnterior: 800, porCategoria: [], ...sobrescritas }
}

const PAYLOAD: EntradaPayload = {
  descricao: 'Salário',
  valor: 5000,
  data: '2026-08-05',
  categoriaId: 'cat_1',
  recorrente: false,
}

const ITENS = [entrada('e1'), entrada('e2')]

/** Última chamada de `listar`, para conferir o filtro montado pelo store. */
function ultimoFiltro() {
  return servico.listar.mock.calls.at(-1)![0]
}

beforeEach(() => {
  setActivePinia(createPinia())
  usePeriodoStore().definir({ mes: 8, ano: 2026 })

  vi.resetAllMocks()
  servico.listar.mockImplementation(async (filtro) => ({
    items: ITENS,
    page: filtro.page,
    pageSize: filtro.pageSize,
    total: 20,
    totalPages: 3,
  }))
  servico.resumo.mockResolvedValue(resumo())
  servico.criar.mockResolvedValue(entrada('novo'))
  servico.atualizar.mockResolvedValue(entrada('e1'))
  servico.remover.mockResolvedValue(undefined)
})

describe('estado inicial', () => {
  it('começa vazio e na página 1', () => {
    const store = useEntradaStore()

    expect(store.itens).toEqual([])
    expect(store.resumo).toBeNull()
    expect(store.page).toBe(1)
    expect(store.pageSize).toBe(8)
    expect(store.totalPages).toBe(1)
    expect(store.categoriaId).toBeNull()
    expect(store.busca).toBe('')
  })
})

describe('carregar', () => {
  it('monta o filtro com período, categoria, busca, página e pageSize', async () => {
    usePeriodoStore().definir({ mes: 3, ano: 2025 })
    const store = useEntradaStore()
    store.categoriaId = 'cat_9'
    store.busca = 'salário'
    store.page = 2

    await store.carregar()

    expect(servico.listar).toHaveBeenCalledWith({
      periodo: { mes: 3, ano: 2025 },
      categoriaId: 'cat_9',
      busca: 'salário',
      page: 2,
      pageSize: 8,
    })
    expect(servico.resumo).toHaveBeenCalledWith({ mes: 3, ano: 2025 })
  })

  it('preenche itens, paginação e resumo', async () => {
    const store = useEntradaStore()

    await store.carregar()

    expect(store.itens).toEqual(ITENS)
    expect(store.total).toBe(20)
    expect(store.totalPages).toBe(3)
    expect(store.page).toBe(1)
    expect(store.resumo).toEqual(resumo())
    expect(store.erro).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('adota a página normalizada devolvida pelo service', async () => {
    servico.listar.mockResolvedValue({ items: ITENS, page: 3, pageSize: 8, total: 20, totalPages: 3 })
    const store = useEntradaStore()
    store.page = 99

    await store.carregar()

    expect(store.page).toBe(3)
  })

  it('mantém loading verdadeiro durante a chamada', async () => {
    let concluir!: () => void
    servico.listar.mockReturnValue(
      new Promise((resolve) => {
        concluir = () => resolve({ items: ITENS, page: 1, pageSize: 8, total: 2, totalPages: 1 })
      }),
    )
    const store = useEntradaStore()

    const promessa = store.carregar()
    expect(store.loading).toBe(true)
    concluir()
    await promessa

    expect(store.loading).toBe(false)
  })

  it('falha: preenche erro, zera itens e desliga o loading', async () => {
    const store = useEntradaStore()
    await store.carregar()
    expect(store.itens).toHaveLength(2)
    servico.listar.mockRejectedValue(new Error('Servidor fora do ar'))

    await store.carregar()

    expect(store.erro).toBe('Servidor fora do ar')
    expect(store.itens).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('falha no resumo também é tratada', async () => {
    servico.resumo.mockRejectedValue('quebrou')
    const store = useEntradaStore()

    await store.carregar()

    expect(store.erro).toBe('Não foi possível carregar as entradas.')
    expect(store.itens).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('uma nova carga bem-sucedida limpa o erro', async () => {
    servico.listar.mockRejectedValueOnce(new Error('falhou'))
    const store = useEntradaStore()
    await store.carregar()

    await store.carregar()

    expect(store.erro).toBeNull()
    expect(store.itens).toEqual(ITENS)
  })
})

describe('criar', () => {
  it('sucesso: retorna true, volta à página 1 e recarrega', async () => {
    const store = useEntradaStore()
    store.page = 3

    const ok = await store.criar(PAYLOAD)

    expect(ok).toBe(true)
    expect(servico.criar).toHaveBeenCalledWith(PAYLOAD)
    expect(ultimoFiltro().page).toBe(1)
    expect(store.page).toBe(1)
    expect(store.itens).toEqual(ITENS)
    expect(store.salvando).toBe(false)
  })

  it('falha: retorna false, preenche erro, não recarrega e desliga salvando', async () => {
    servico.criar.mockRejectedValue(new Error('Valor inválido'))
    const store = useEntradaStore()

    const ok = await store.criar(PAYLOAD)

    expect(ok).toBe(false)
    expect(store.erro).toBe('Valor inválido')
    expect(servico.listar).not.toHaveBeenCalled()
    expect(store.salvando).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    servico.criar.mockRejectedValue('quebrou')
    const store = useEntradaStore()

    await store.criar(PAYLOAD)

    expect(store.erro).toBe('Não foi possível salvar a entrada.')
  })

  it('mantém salvando verdadeiro enquanto grava', async () => {
    let concluir!: () => void
    servico.criar.mockReturnValue(new Promise((resolve) => (concluir = () => resolve(entrada('novo')))))
    const store = useEntradaStore()

    const promessa = store.criar(PAYLOAD)
    expect(store.salvando).toBe(true)
    concluir()
    await promessa

    expect(store.salvando).toBe(false)
  })
})

describe('atualizar', () => {
  it('sucesso: retorna true e recarrega mantendo a página', async () => {
    const store = useEntradaStore()
    store.page = 2

    const ok = await store.atualizar('e1', PAYLOAD)

    expect(ok).toBe(true)
    expect(servico.atualizar).toHaveBeenCalledWith('e1', PAYLOAD)
    expect(ultimoFiltro().page).toBe(2)
    expect(store.salvando).toBe(false)
  })

  it('falha: retorna false, preenche erro, não recarrega e desliga salvando', async () => {
    servico.atualizar.mockRejectedValue(new Error('Não encontrada'))
    const store = useEntradaStore()

    const ok = await store.atualizar('e1', PAYLOAD)

    expect(ok).toBe(false)
    expect(store.erro).toBe('Não encontrada')
    expect(servico.listar).not.toHaveBeenCalled()
    expect(store.salvando).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    servico.atualizar.mockRejectedValue(undefined)
    const store = useEntradaStore()

    await store.atualizar('e1', PAYLOAD)

    expect(store.erro).toBe('Não foi possível atualizar a entrada.')
  })
})

describe('remover', () => {
  it('sucesso: retorna true e recarrega', async () => {
    const store = useEntradaStore()
    await store.carregar()
    servico.listar.mockClear()

    const ok = await store.remover('e1')

    expect(ok).toBe(true)
    expect(servico.remover).toHaveBeenCalledWith('e1')
    expect(servico.listar).toHaveBeenCalledTimes(1)
    expect(store.salvando).toBe(false)
  })

  it('remover o único item de uma página > 1 recua uma página', async () => {
    const store = useEntradaStore()
    store.itens = [entrada('e1')]
    store.page = 3

    await store.remover('e1')

    expect(ultimoFiltro().page).toBe(2)
    expect(store.page).toBe(2)
  })

  it('não recua na página 1, mesmo removendo o único item', async () => {
    const store = useEntradaStore()
    store.itens = [entrada('e1')]
    store.page = 1

    await store.remover('e1')

    expect(ultimoFiltro().page).toBe(1)
  })

  it('não recua quando a página ainda tem outros itens', async () => {
    const store = useEntradaStore()
    store.itens = [entrada('e1'), entrada('e2')]
    store.page = 3

    await store.remover('e1')

    expect(ultimoFiltro().page).toBe(3)
  })

  it('falha: retorna false, preenche erro, não recarrega e desliga salvando', async () => {
    servico.remover.mockRejectedValue(new Error('Sem permissão'))
    const store = useEntradaStore()
    store.itens = [entrada('e1')]
    store.page = 3

    const ok = await store.remover('e1')

    expect(ok).toBe(false)
    expect(store.erro).toBe('Sem permissão')
    expect(servico.listar).not.toHaveBeenCalled()
    expect(store.salvando).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    servico.remover.mockRejectedValue(null)
    const store = useEntradaStore()

    await store.remover('e1')

    expect(store.erro).toBe('Não foi possível excluir a entrada.')
  })
})

describe('irParaPagina', () => {
  it('respeita os limites mínimo e máximo e recarrega', async () => {
    const store = useEntradaStore()
    await store.carregar()
    expect(store.totalPages).toBe(3)
    servico.listar.mockClear()

    store.irParaPagina(0)
    await flushPromises()
    expect(ultimoFiltro().page).toBe(1)

    store.irParaPagina(99)
    await flushPromises()
    expect(ultimoFiltro().page).toBe(3)
    expect(store.page).toBe(3)

    store.irParaPagina(2)
    await flushPromises()
    expect(ultimoFiltro().page).toBe(2)
    expect(store.page).toBe(2)

    expect(servico.listar).toHaveBeenCalledTimes(3)
  })
})

describe('filtros', () => {
  it('filtrarPorCategoria volta à página 1 e recarrega', async () => {
    const store = useEntradaStore()
    store.page = 3

    store.filtrarPorCategoria('cat_7')
    await flushPromises()

    expect(store.categoriaId).toBe('cat_7')
    expect(store.page).toBe(1)
    expect(ultimoFiltro()).toMatchObject({ categoriaId: 'cat_7', page: 1 })
  })

  it('buscar volta à página 1 e recarrega', async () => {
    const store = useEntradaStore()
    store.page = 3

    store.buscar('mercado')
    await flushPromises()

    expect(store.busca).toBe('mercado')
    expect(store.page).toBe(1)
    expect(ultimoFiltro()).toMatchObject({ busca: 'mercado', page: 1 })
  })

  it('limparFiltros zera categoria e busca, volta à página 1 e recarrega', async () => {
    const store = useEntradaStore()
    store.categoriaId = 'cat_7'
    store.busca = 'mercado'
    store.page = 3

    store.limparFiltros()
    await flushPromises()

    expect(store.categoriaId).toBeNull()
    expect(store.busca).toBe('')
    expect(store.page).toBe(1)
    expect(ultimoFiltro()).toMatchObject({ categoriaId: null, busca: '', page: 1 })
  })
})

describe('temFiltroAtivo', () => {
  it('é falso sem categoria e sem busca', () => {
    expect(useEntradaStore().temFiltroAtivo).toBe(false)
  })

  it('é verdadeiro com categoria', () => {
    const store = useEntradaStore()

    store.categoriaId = 'cat_1'

    expect(store.temFiltroAtivo).toBe(true)
  })

  it('é verdadeiro com busca preenchida', () => {
    const store = useEntradaStore()

    store.busca = 'abc'

    expect(store.temFiltroAtivo).toBe(true)
  })

  it('busca só com espaços não conta como filtro', () => {
    const store = useEntradaStore()

    store.busca = '   '

    expect(store.temFiltroAtivo).toBe(false)
  })
})

describe('vazio', () => {
  it('é verdadeiro sem itens e sem loading', () => {
    expect(useEntradaStore().vazio).toBe(true)
  })

  it('é falso com itens', async () => {
    const store = useEntradaStore()

    await store.carregar()

    expect(store.vazio).toBe(false)
  })

  it('é falso enquanto carrega, mesmo sem itens', async () => {
    let concluir!: () => void
    servico.listar.mockReturnValue(
      new Promise((resolve) => {
        concluir = () => resolve({ items: [], page: 1, pageSize: 8, total: 0, totalPages: 1 })
      }),
    )
    const store = useEntradaStore()

    const promessa = store.carregar()
    expect(store.vazio).toBe(false)
    concluir()
    await promessa

    expect(store.vazio).toBe(true)
  })
})

describe('totalPeriodo / variacao', () => {
  it('são 0 sem resumo', () => {
    const store = useEntradaStore()

    expect(store.totalPeriodo).toBe(0)
    expect(store.variacao).toBe(0)
  })

  it('totalPeriodo vem do resumo', async () => {
    servico.resumo.mockResolvedValue(resumo({ total: 1234 }))
    const store = useEntradaStore()

    await store.carregar()

    expect(store.totalPeriodo).toBe(1234)
  })

  it('variacao compara com o mês anterior', async () => {
    servico.resumo.mockResolvedValue(resumo({ total: 150, totalMesAnterior: 100 }))
    const store = useEntradaStore()

    await store.carregar()

    expect(store.variacao).toBe(0.5)
  })

  it('variacao com mês anterior zerado vira 1 se houve entrada e 0 se não houve', async () => {
    const store = useEntradaStore()

    servico.resumo.mockResolvedValue(resumo({ total: 150, totalMesAnterior: 0 }))
    await store.carregar()
    expect(store.variacao).toBe(1)

    servico.resumo.mockResolvedValue(resumo({ total: 0, totalMesAnterior: 0 }))
    await store.carregar()
    expect(store.variacao).toBe(0)
  })
})
