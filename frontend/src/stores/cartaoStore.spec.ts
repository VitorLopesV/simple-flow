import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cartaoService } from '@/services/cartaoService'
import { useCartaoStore } from '@/stores/cartaoStore'
import { usePeriodoStore } from '@/stores/periodoStore'
import type {
  Cartao,
  CartaoComFatura,
  CartaoPayload,
  FaturaStatus,
  TransacaoCartao,
  TransacaoCartaoPayload,
} from '@/types/cartao'

vi.mock('@/services/cartaoService', () => ({
  cartaoService: {
    listarComFaturas: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    remover: vi.fn(),
    criarTransacao: vi.fn(),
    atualizarTransacao: vi.fn(),
    removerTransacao: vi.fn(),
    pagarFatura: vi.fn(),
  },
}))

const servico = vi.mocked(cartaoService)

function cartao(id: string, sobrescritas: Partial<Cartao> = {}): Cartao {
  return {
    id,
    nome: `Cartão ${id}`,
    bandeira: 'VISA',
    ultimosDigitos: '1234',
    limite: 1000,
    diaFechamento: 20,
    diaVencimento: 27,
    cor: '#000000',
    ativo: true,
    criadoEm: '',
    ...sobrescritas,
  }
}

function transacao(id: string, sobrescritas: Partial<TransacaoCartao> = {}): TransacaoCartao {
  return {
    id,
    cartaoId: 'A',
    faturaId: 'fat_A',
    descricao: `Compra ${id}`,
    valor: 50,
    data: '2026-08-10',
    categoriaId: 'cat_1',
    tipo: 'OUTROS',
    parcelaAtual: 1,
    totalParcelas: 1,
    recorrente: false,
    observacao: null,
    criadoEm: '',
    atualizadoEm: '',
    ...sobrescritas,
  }
}

interface OpcoesComFatura {
  cartao?: Partial<Cartao>
  /** `null` = cartão sem fatura na competência. */
  fatura?: { total?: number; status?: FaturaStatus; transacoes?: TransacaoCartao[] } | null
}

function comFatura(id: string, { cartao: dadosCartao = {}, fatura = {} }: OpcoesComFatura = {}): CartaoComFatura {
  return {
    cartao: cartao(id, dadosCartao),
    fatura:
      fatura === null
        ? null
        : {
            id: `fat_${id}`,
            cartaoId: id,
            competencia: '2026-08',
            fechamento: '2026-08-20',
            vencimento: '2026-08-27',
            total: fatura.total ?? 0,
            status: fatura.status ?? 'ABERTA',
            pagoEm: null,
            transacoes: fatura.transacoes ?? [],
          },
    usoLimite: 0,
  }
}

const CARTAO_PAYLOAD: CartaoPayload = {
  nome: 'Novo',
  bandeira: 'ELO',
  ultimosDigitos: '9999',
  limite: 500,
  diaFechamento: 10,
  diaVencimento: 17,
  cor: '#ffffff',
  ativo: true,
}

function payloadTransacao(sobrescritas: Partial<TransacaoCartaoPayload> = {}): TransacaoCartaoPayload {
  return {
    descricao: 'Notebook',
    valor: 100,
    data: '2026-08-10',
    categoriaId: 'cat_1',
    tipo: 'OUTROS',
    parcelaAtual: 1,
    totalParcelas: 1,
    recorrente: false,
    observacao: 'presente',
    ...sobrescritas,
  }
}

/** Store já carregado com a lista informada. */
async function storeCom(lista: CartaoComFatura[]) {
  servico.listarComFaturas.mockResolvedValue(lista)
  const store = useCartaoStore()
  await store.carregar()
  return store
}

/** Chamadas de `criarTransacao` decompostas em (cartaoId, payload). */
function parcelasEnviadas(): { cartaoId: string; payload: TransacaoCartaoPayload }[] {
  return servico.criarTransacao.mock.calls.map(([cartaoId, payload]) => ({ cartaoId, payload }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  usePeriodoStore().definir({ mes: 8, ano: 2026 })

  vi.resetAllMocks()
  servico.listarComFaturas.mockResolvedValue([comFatura('A'), comFatura('B')])
  servico.criar.mockResolvedValue(cartao('B'))
  servico.atualizar.mockResolvedValue(cartao('A'))
  servico.remover.mockResolvedValue(undefined)
  servico.criarTransacao.mockResolvedValue(transacao('novo'))
  servico.atualizarTransacao.mockResolvedValue(transacao('t1'))
  servico.removerTransacao.mockResolvedValue(undefined)
  servico.pagarFatura.mockResolvedValue(undefined)
})

describe('criarTransacao: parcelamento', () => {
  it('à vista (totalParcelas 1) faz uma única chamada com o payload original', async () => {
    const store = useCartaoStore()
    const payload = payloadTransacao({ valor: 100, totalParcelas: 1 })

    const ok = await store.criarTransacao('A', payload)

    expect(ok).toBe(true)
    expect(servico.criarTransacao).toHaveBeenCalledTimes(1)
    expect(servico.criarTransacao).toHaveBeenCalledWith('A', payload)
    expect(servico.listarComFaturas).toHaveBeenCalledTimes(1)
    expect(store.salvando).toBe(false)
  })

  it('totalParcelas 0 é tratado como à vista', async () => {
    const store = useCartaoStore()
    const payload = payloadTransacao({ totalParcelas: 0 })

    await store.criarTransacao('A', payload)

    expect(servico.criarTransacao).toHaveBeenCalledTimes(1)
    expect(servico.criarTransacao).toHaveBeenCalledWith('A', payload)
  })

  it('3 parcelas de R$ 100,00 dão 33,34 / 33,33 / 33,33, com o resto nas primeiras', async () => {
    const store = useCartaoStore()

    await store.criarTransacao('A', payloadTransacao({ valor: 100, totalParcelas: 3 }))

    expect(parcelasEnviadas().map((p) => p.payload.valor)).toEqual([33.34, 33.33, 33.33])
  })

  it.each([
    [100, 3],
    [100, 7],
    [19.99, 3],
    [1234.56, 12],
    [99.99, 10],
    [0.1 + 0.2, 3],
    [0.05, 4],
    [1000, 6],
  ])('a soma das parcelas de %f em %i vezes é exatamente o valor original', async (valor, parcelas) => {
    const store = useCartaoStore()

    await store.criarTransacao('A', payloadTransacao({ valor, totalParcelas: parcelas }))

    const centavos = parcelasEnviadas().map((p) => Math.round(p.payload.valor * 100))
    expect(centavos).toHaveLength(parcelas)
    expect(centavos.reduce((soma, c) => soma + c, 0)).toBe(Math.round(valor * 100))
    // O resto fica nas primeiras: nunca uma parcela posterior maior que a anterior.
    for (let i = 1; i < centavos.length; i += 1) expect(centavos[i]!).toBeLessThanOrEqual(centavos[i - 1]!)
    expect(Math.max(...centavos) - Math.min(...centavos)).toBeLessThanOrEqual(1)
  })

  it('numera as parcelas de 1 a N com totalParcelas e preserva os demais campos', async () => {
    const store = useCartaoStore()

    await store.criarTransacao('A', payloadTransacao({ valor: 90, totalParcelas: 3 }))

    const enviadas = parcelasEnviadas()
    expect(enviadas.map((p) => p.cartaoId)).toEqual(['A', 'A', 'A'])
    expect(enviadas.map((p) => p.payload.parcelaAtual)).toEqual([1, 2, 3])
    expect(enviadas.every((p) => p.payload.totalParcelas === 3)).toBe(true)
    for (const { payload } of enviadas) {
      expect(payload).toMatchObject({
        descricao: 'Notebook',
        categoriaId: 'cat_1',
        tipo: 'OUTROS',
        observacao: 'presente',
        recorrente: false,
      })
    }
  })

  it('12 parcelas iniciando em novembro atravessam a virada de ano', async () => {
    const store = useCartaoStore()

    await store.criarTransacao('A', payloadTransacao({ data: '2026-11-15', valor: 1200, totalParcelas: 12 }))

    expect(parcelasEnviadas().map((p) => p.payload.data)).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
      '2027-02-15',
      '2027-03-15',
      '2027-04-15',
      '2027-05-15',
      '2027-06-15',
      '2027-07-15',
      '2027-08-15',
      '2027-09-15',
      '2027-10-15',
    ])
  })

  it('compra no dia 31 cai no último dia dos meses curtos', async () => {
    const store = useCartaoStore()

    await store.criarTransacao('A', payloadTransacao({ data: '2026-01-31', valor: 400, totalParcelas: 4 }))

    expect(parcelasEnviadas().map((p) => p.payload.data)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('respeita ano bissexto em fevereiro', async () => {
    const store = useCartaoStore()

    await store.criarTransacao('A', payloadTransacao({ data: '2027-12-31', valor: 300, totalParcelas: 3 }))

    expect(parcelasEnviadas().map((p) => p.payload.data)).toEqual(['2027-12-31', '2028-01-31', '2028-02-29'])
  })

  it('dispara as parcelas em paralelo, sem esperar uma terminar para iniciar a próxima', async () => {
    const resolvers: (() => void)[] = []
    servico.criarTransacao.mockImplementation(
      () => new Promise((resolve) => resolvers.push(() => resolve(transacao('x')))),
    )
    const store = useCartaoStore()

    const promessa = store.criarTransacao('A', payloadTransacao({ valor: 300, totalParcelas: 3 }))

    expect(servico.criarTransacao).toHaveBeenCalledTimes(3)
    expect(store.salvando).toBe(true)
    resolvers.forEach((resolver) => resolver())
    await promessa
    expect(store.salvando).toBe(false)
  })

  it('recarrega os cartões uma única vez depois de todas as parcelas', async () => {
    const store = useCartaoStore()

    await store.criarTransacao('A', payloadTransacao({ valor: 300, totalParcelas: 3 }))

    expect(servico.listarComFaturas).toHaveBeenCalledTimes(1)
  })

  it('falha no meio: retorna false, preenche erro, desliga salvando e não recarrega', async () => {
    servico.criarTransacao
      .mockResolvedValueOnce(transacao('p1'))
      .mockRejectedValueOnce(new Error('Limite excedido'))
      .mockResolvedValueOnce(transacao('p3'))
    const store = useCartaoStore()

    const ok = await store.criarTransacao('A', payloadTransacao({ valor: 300, totalParcelas: 3 }))

    expect(ok).toBe(false)
    expect(store.erro).toBe('Limite excedido')
    expect(store.salvando).toBe(false)
    expect(servico.listarComFaturas).not.toHaveBeenCalled()
  })

  it('falha à vista sem mensagem aproveitável usa o texto padrão', async () => {
    servico.criarTransacao.mockRejectedValue('quebrou')
    const store = useCartaoStore()

    const ok = await store.criarTransacao('A', payloadTransacao())

    expect(ok).toBe(false)
    expect(store.erro).toBe('Não foi possível salvar o débito.')
  })
})

describe('carregar e seleção', () => {
  it('usa o período do periodoStore e preenche os cartões', async () => {
    usePeriodoStore().definir({ mes: 3, ano: 2025 })
    const lista = [comFatura('A'), comFatura('B')]
    servico.listarComFaturas.mockResolvedValue(lista)
    const store = useCartaoStore()

    await store.carregar()

    expect(servico.listarComFaturas).toHaveBeenCalledWith({ periodo: { mes: 3, ano: 2025 } })
    expect(store.cartoes).toEqual(lista)
    expect(store.erro).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('mantém loading verdadeiro durante a chamada', async () => {
    let concluir!: () => void
    servico.listarComFaturas.mockReturnValue(new Promise((resolve) => (concluir = () => resolve([]))))
    const store = useCartaoStore()

    const promessa = store.carregar()
    expect(store.loading).toBe(true)
    concluir()
    await promessa

    expect(store.loading).toBe(false)
  })

  it('falha: preenche erro, zera os cartões e desliga o loading', async () => {
    const store = await storeCom([comFatura('A')])
    servico.listarComFaturas.mockRejectedValue(new Error('Servidor fora do ar'))

    await store.carregar()

    expect(store.erro).toBe('Servidor fora do ar')
    expect(store.cartoes).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    servico.listarComFaturas.mockRejectedValue('quebrou')
    const store = useCartaoStore()

    await store.carregar()

    expect(store.erro).toBe('Não foi possível carregar os cartões.')
  })

  it('seleciona o primeiro cartão na primeira carga', async () => {
    const store = await storeCom([comFatura('A'), comFatura('B')])

    expect(store.cartaoSelecionadoId).toBe('A')
    expect(store.selecionado?.cartao.id).toBe('A')
  })

  it('mantém o cartão selecionado enquanto ele ainda existe', async () => {
    const store = await storeCom([comFatura('A'), comFatura('B')])
    store.selecionar('B')

    await store.carregar()

    expect(store.cartaoSelecionadoId).toBe('B')
    expect(store.selecionado?.cartao.id).toBe('B')
  })

  it('se o cartão selecionado deixou de existir, seleciona o primeiro', async () => {
    const store = await storeCom([comFatura('A'), comFatura('B')])
    store.selecionar('B')
    servico.listarComFaturas.mockResolvedValue([comFatura('C'), comFatura('A')])

    await store.carregar()

    expect(store.cartaoSelecionadoId).toBe('C')
  })

  it('lista vazia deixa a seleção nula', async () => {
    const store = await storeCom([comFatura('A')])
    servico.listarComFaturas.mockResolvedValue([])

    await store.carregar()

    expect(store.cartaoSelecionadoId).toBeNull()
    expect(store.selecionado).toBeNull()
  })

  it('selecionado faz fallback ao primeiro cartão quando o id é desconhecido', async () => {
    const store = await storeCom([comFatura('A'), comFatura('B')])

    store.selecionar('inexistente')

    expect(store.selecionado?.cartao.id).toBe('A')
  })

  it('criar seleciona o cartão criado', async () => {
    servico.criar.mockResolvedValue(cartao('B'))
    const store = await storeCom([comFatura('A'), comFatura('B')])
    expect(store.cartaoSelecionadoId).toBe('A')

    const ok = await store.criar(CARTAO_PAYLOAD)

    expect(ok).toBe(true)
    expect(servico.criar).toHaveBeenCalledWith(CARTAO_PAYLOAD)
    expect(store.cartaoSelecionadoId).toBe('B')
    expect(store.selecionado?.cartao.id).toBe('B')
    expect(store.salvando).toBe(false)
  })
})

describe('getters', () => {
  it('totalFaturas soma as faturas e ignora cartões sem fatura', async () => {
    const store = await storeCom([
      comFatura('A', { fatura: { total: 100 } }),
      comFatura('B', { fatura: null }),
      comFatura('C', { fatura: { total: 250.5 } }),
    ])

    expect(store.totalFaturas).toBe(350.5)
  })

  it('limiteTotal soma só os cartões ativos', async () => {
    const store = await storeCom([
      comFatura('A', { cartao: { limite: 1000, ativo: true } }),
      comFatura('B', { cartao: { limite: 500, ativo: false } }),
      comFatura('C', { cartao: { limite: 2000, ativo: true } }),
    ])

    expect(store.limiteTotal).toBe(3000)
  })

  it('faturasEmAberto conta faturas existentes que não estão PAGA', async () => {
    const store = await storeCom([
      comFatura('A', { fatura: { status: 'ABERTA' } }),
      comFatura('B', { fatura: { status: 'PAGA' } }),
      comFatura('C', { fatura: null }),
      comFatura('D', { fatura: { status: 'ATRASADA' } }),
      comFatura('E', { fatura: { status: 'FECHADA' } }),
    ])

    expect(store.faturasEmAberto).toBe(3)
  })

  it('vazio é verdadeiro sem cartões e sem loading', () => {
    expect(useCartaoStore().vazio).toBe(true)
  })

  it('vazio é falso com cartões', async () => {
    const store = await storeCom([comFatura('A')])

    expect(store.vazio).toBe(false)
  })

  it('vazio é falso enquanto carrega', async () => {
    let concluir!: () => void
    servico.listarComFaturas.mockReturnValue(new Promise((resolve) => (concluir = () => resolve([]))))
    const store = useCartaoStore()

    const promessa = store.carregar()
    expect(store.vazio).toBe(false)
    concluir()
    await promessa

    expect(store.vazio).toBe(true)
  })

  it('opcoesDeCartao lista só os ativos com o rótulo "Nome ····1234"', async () => {
    const store = await storeCom([
      comFatura('A', { cartao: { nome: 'Nubank', ultimosDigitos: '4821', ativo: true } }),
      comFatura('B', { cartao: { nome: 'Inter', ultimosDigitos: '2277', ativo: false } }),
      comFatura('C', { cartao: { nome: 'Itaú', ultimosDigitos: '9013', ativo: true } }),
    ])

    expect(store.opcoesDeCartao).toEqual([
      { label: 'Nubank ····4821', value: 'A' },
      { label: 'Itaú ····9013', value: 'C' },
    ])
  })

  it('porId devolve o cartão ou null', async () => {
    const store = await storeCom([comFatura('A', { cartao: { nome: 'Nubank' } })])

    expect(store.porId('A')?.nome).toBe('Nubank')
    expect(store.porId('inexistente')).toBeNull()
    expect(store.porId(null)).toBeNull()
    expect(store.porId(undefined)).toBeNull()
  })
})

describe('filtros', () => {
  const transacoes = [
    transacao('t1', { descricao: 'Supermercado', observacao: 'compra do mês', tipo: 'ALIMENTACAO', categoriaId: 'c1' }),
    transacao('t2', { descricao: 'Café', tipo: 'ALIMENTACAO', categoriaId: 'c2' }),
    transacao('t3', { descricao: 'Uber', tipo: 'TRANSPORTE', categoriaId: 'c1' }),
    transacao('t4', { descricao: 'Cinema', observacao: 'Sessão', tipo: 'LAZER', categoriaId: 'c2' }),
  ]

  const ids = (lista: TransacaoCartao[]) => lista.map((t) => t.id)

  async function storeComTransacoes() {
    return storeCom([comFatura('A', { fatura: { transacoes } }), comFatura('B')])
  }

  it('sem filtros devolve todas as transações da fatura selecionada', async () => {
    const store = await storeComTransacoes()

    expect(ids(store.transacoesFiltradas)).toEqual(['t1', 't2', 't3', 't4'])
  })

  it('só considera o cartão selecionado', async () => {
    const store = await storeComTransacoes()

    store.selecionar('B')

    expect(store.transacoesFiltradas).toEqual([])
  })

  it('sem cartões ou sem fatura devolve lista vazia', async () => {
    expect(useCartaoStore().transacoesFiltradas).toEqual([])

    const store = await storeCom([comFatura('A', { fatura: null })])
    expect(store.transacoesFiltradas).toEqual([])
  })

  it('busca sem diferenciar acento nem caixa', async () => {
    const store = await storeComTransacoes()

    store.buscar('CAFE')

    expect(ids(store.transacoesFiltradas)).toEqual(['t2'])
  })

  it('busca também na observação', async () => {
    const store = await storeComTransacoes()

    store.buscar('sessao')
    expect(ids(store.transacoesFiltradas)).toEqual(['t4'])

    store.buscar('do MES')
    expect(ids(store.transacoesFiltradas)).toEqual(['t1'])
  })

  it('filtra por categoria', async () => {
    const store = await storeComTransacoes()

    store.filtrarPorCategoria('c1')

    expect(ids(store.transacoesFiltradas)).toEqual(['t1', 't3'])
  })

  it('filtra por tipo', async () => {
    const store = await storeComTransacoes()

    store.filtrarPorTipo('ALIMENTACAO')

    expect(ids(store.transacoesFiltradas)).toEqual(['t1', 't2'])
  })

  it('combina categoria, tipo e busca', async () => {
    const store = await storeComTransacoes()

    store.filtrarPorCategoria('c2')
    store.filtrarPorTipo('ALIMENTACAO')
    expect(ids(store.transacoesFiltradas)).toEqual(['t2'])

    store.buscar('uber')
    expect(store.transacoesFiltradas).toEqual([])
  })

  it('filtrar não recarrega os cartões (é client-side)', async () => {
    const store = await storeComTransacoes()
    servico.listarComFaturas.mockClear()

    store.filtrarPorCategoria('c1')
    store.filtrarPorTipo('LAZER')
    store.buscar('x')
    store.limparFiltros()

    expect(servico.listarComFaturas).not.toHaveBeenCalled()
  })

  it('temFiltroAtivo reage a categoria, tipo e busca, ignorando espaços', () => {
    const store = useCartaoStore()
    expect(store.temFiltroAtivo).toBe(false)

    store.buscar('   ')
    expect(store.temFiltroAtivo).toBe(false)

    store.buscar('abc')
    expect(store.temFiltroAtivo).toBe(true)
    store.buscar('')

    store.filtrarPorCategoria('c1')
    expect(store.temFiltroAtivo).toBe(true)
    store.filtrarPorCategoria(null)

    store.filtrarPorTipo('LAZER')
    expect(store.temFiltroAtivo).toBe(true)
  })

  it('limparFiltros zera categoria, tipo e busca', async () => {
    const store = await storeComTransacoes()
    store.filtrarPorCategoria('c1')
    store.filtrarPorTipo('LAZER')
    store.buscar('abc')

    store.limparFiltros()

    expect(store.categoriaId).toBeNull()
    expect(store.tipo).toBeNull()
    expect(store.busca).toBe('')
    expect(store.temFiltroAtivo).toBe(false)
    expect(ids(store.transacoesFiltradas)).toEqual(['t1', 't2', 't3', 't4'])
  })
})

describe('ações', () => {
  const acoes = [
    {
      nome: 'atualizar',
      chamar: (store: ReturnType<typeof useCartaoStore>) => store.atualizar('A', CARTAO_PAYLOAD),
      metodo: () => servico.atualizar,
      argumentos: ['A', CARTAO_PAYLOAD],
      padrao: 'Não foi possível atualizar o cartão.',
    },
    {
      nome: 'remover',
      chamar: (store: ReturnType<typeof useCartaoStore>) => store.remover('A'),
      metodo: () => servico.remover,
      argumentos: ['A'],
      padrao: 'Não foi possível excluir o cartão.',
    },
    {
      nome: 'atualizarTransacao',
      chamar: (store: ReturnType<typeof useCartaoStore>) => store.atualizarTransacao('A', 't1', payloadTransacao()),
      metodo: () => servico.atualizarTransacao,
      argumentos: ['A', 't1', payloadTransacao()],
      padrao: 'Não foi possível atualizar o débito.',
    },
    {
      nome: 'removerTransacao',
      chamar: (store: ReturnType<typeof useCartaoStore>) => store.removerTransacao('A', 't1'),
      metodo: () => servico.removerTransacao,
      argumentos: ['A', 't1'],
      padrao: 'Não foi possível excluir o débito.',
    },
    {
      nome: 'pagarFatura',
      chamar: (store: ReturnType<typeof useCartaoStore>) => store.pagarFatura('fat_A'),
      metodo: () => servico.pagarFatura,
      argumentos: ['fat_A'],
      padrao: 'Não foi possível registrar o pagamento.',
    },
    {
      nome: 'criar',
      chamar: (store: ReturnType<typeof useCartaoStore>) => store.criar(CARTAO_PAYLOAD),
      metodo: () => servico.criar,
      argumentos: [CARTAO_PAYLOAD],
      padrao: 'Não foi possível salvar o cartão.',
    },
  ]

  it.each(acoes)('$nome: sucesso retorna true, chama o service e recarrega', async ({ chamar, metodo, argumentos }) => {
    const store = useCartaoStore()

    const ok = await chamar(store)

    expect(ok).toBe(true)
    expect(metodo()).toHaveBeenCalledWith(...argumentos)
    expect(servico.listarComFaturas).toHaveBeenCalledTimes(1)
    expect(store.salvando).toBe(false)
  })

  it.each(acoes)('$nome: falha retorna false, preenche erro e não recarrega', async ({ chamar, metodo }) => {
    metodo().mockRejectedValue(new Error('Falha específica'))
    const store = useCartaoStore()

    const ok = await chamar(store)

    expect(ok).toBe(false)
    expect(store.erro).toBe('Falha específica')
    expect(servico.listarComFaturas).not.toHaveBeenCalled()
    expect(store.salvando).toBe(false)
  })

  it.each(acoes)('$nome: falha sem mensagem aproveitável usa o texto padrão', async ({ chamar, metodo, padrao }) => {
    metodo().mockRejectedValue('quebrou')
    const store = useCartaoStore()

    await chamar(store)

    expect(store.erro).toBe(padrao)
  })

  it('mantém salvando verdadeiro enquanto a ação está em andamento', async () => {
    let concluir!: () => void
    servico.pagarFatura.mockReturnValue(new Promise((resolve) => (concluir = () => resolve(undefined))))
    const store = useCartaoStore()

    const promessa = store.pagarFatura('fat_A')
    expect(store.salvando).toBe(true)
    concluir()
    await promessa

    expect(store.salvando).toBe(false)
  })
})
