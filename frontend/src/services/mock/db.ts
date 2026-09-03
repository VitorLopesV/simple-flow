/**
 * Banco de dados em memória usado durante o desenvolvimento.
 *
 * A seed do faker é fixa para que os dados sejam estáveis entre reloads da
 * mesma sessão e entre máquinas — útil para revisar telas e comparar prints.
 * Os dados NÃO são persistidos: recarregar a página recria a base.
 */
import { faker } from '@faker-js/faker/locale/pt_BR'

import type { Cartao, Fatura, TransacaoCartao } from '@/types/cartao'
import type { Categoria } from '@/types/categoria'
import type { ID, Periodo } from '@/types/common'
import type { Entrada } from '@/types/entrada'
import type { FormaPagamento, Saida, SaidaTipo } from '@/types/saida'
import {
  addMeses,
  diaDoPeriodo,
  fromCompetencia,
  periodoAtual,
  toCompetencia,
  toDate,
  toISODate,
} from '@/utils/dateFormatter'

faker.seed(20260815)

let sequencia = 0
export function novoId(prefixo: string): string {
  sequencia += 1
  return `${prefixo}_${sequencia.toString().padStart(5, '0')}`
}

export function agora(): string {
  return new Date().toISOString()
}

/** Clona para que consumidores não mutem o "banco" por referência. */
export function clonar<T>(valor: T): T {
  return structuredClone(valor)
}

// ---------------------------------------------------------------- categorias

const SEMENTE_CATEGORIAS: Omit<Categoria, 'id'>[] = [
  // Saída — apenas os 3 grandes grupos; a classificação específica vai no campo `tipo` da Saida.
  { nome: 'Despesa Fixa', tipo: 'CONTA_FIXA', movimento: 'SAIDA', cor: '#6366f1' },
  { nome: 'Despesa Variável', tipo: 'CONTA_VARIAVEL', movimento: 'SAIDA', cor: '#14b8a6' },
  { nome: 'Investimento', tipo: 'INVESTIMENTO', movimento: 'SAIDA', cor: '#0891b2' },
  // Renda
  { nome: 'Salário', tipo: 'RENDA', movimento: 'ENTRADA', cor: '#10b981' },
  { nome: 'Freelance', tipo: 'RENDA', movimento: 'ENTRADA', cor: '#06b6d4' },
  { nome: 'Reembolso', tipo: 'RENDA', movimento: 'ENTRADA', cor: '#84cc16' },
  { nome: 'Outras receitas', tipo: 'OUTROS', movimento: 'ENTRADA', cor: '#94a3b8' },
  { nome: 'Rendimentos', tipo: 'INVESTIMENTO', movimento: 'ENTRADA', cor: '#eab308' },
]

export const categorias: Categoria[] = SEMENTE_CATEGORIAS.map((categoria) => ({
  ...categoria,
  id: novoId('cat'),
}))

function categoriaPorNome(nome: string): Categoria {
  const encontrada = categorias.find((categoria) => categoria.nome === nome)
  if (!encontrada) throw new Error(`Categoria de semente ausente: ${nome}`)
  return encontrada
}

// ------------------------------------------------------------------- cartões

export const cartoes: Cartao[] = [
  {
    id: novoId('car'),
    nome: 'Nubank Ultravioleta',
    bandeira: 'MASTERCARD',
    ultimosDigitos: '4821',
    limite: 12_000,
    diaFechamento: 20,
    diaVencimento: 27,
    cor: '#8b5cf6',
    ativo: true,
    criadoEm: agora(),
  },
  {
    id: novoId('car'),
    nome: 'Itaú Click',
    bandeira: 'VISA',
    ultimosDigitos: '9013',
    limite: 7_500,
    diaFechamento: 5,
    diaVencimento: 12,
    cor: '#f97316',
    ativo: true,
    criadoEm: agora(),
  },
  {
    id: novoId('car'),
    nome: 'Inter Gold',
    bandeira: 'ELO',
    ultimosDigitos: '2277',
    limite: 4_000,
    diaFechamento: 25,
    diaVencimento: 3,
    cor: '#ea580c',
    ativo: false,
    criadoEm: agora(),
  },
]

// ------------------------------------------------------------------ entradas

export const entradas: Entrada[] = []
export const saidas: Saida[] = []
export const faturas: Fatura[] = []
export const transacoesCartao: TransacaoCartao[] = []

const MESES_DE_HISTORICO = 8
const base = periodoAtual()

for (let offset = MESES_DE_HISTORICO - 1; offset >= 0; offset -= 1) {
  const periodo = addMeses(base, -offset)
  const salario = faker.number.int({ min: 7200, max: 7800 })

  entradas.push({
    id: novoId('ent'),
    descricao: 'Salário mensal',
    valor: salario,
    data: diaDoPeriodo(periodo, 5),
    categoriaId: categoriaPorNome('Salário').id,
    recorrente: true,
    observacao: 'Crédito em conta corrente',
    criadoEm: agora(),
    atualizadoEm: agora(),
  })

  const freelances = faker.number.int({ min: 0, max: 2 })
  for (let i = 0; i < freelances; i += 1) {
    entradas.push({
      id: novoId('ent'),
      descricao: `Projeto ${faker.company.name()}`,
      valor: faker.number.int({ min: 800, max: 4200 }),
      data: diaDoPeriodo(periodo, faker.number.int({ min: 8, max: 26 })),
      categoriaId: categoriaPorNome('Freelance').id,
      recorrente: false,
      criadoEm: agora(),
      atualizadoEm: agora(),
    })
  }

  if (faker.datatype.boolean(0.6)) {
    entradas.push({
      id: novoId('ent'),
      descricao: 'Rendimento CDB',
      valor: faker.number.int({ min: 90, max: 620 }),
      data: diaDoPeriodo(periodo, faker.number.int({ min: 1, max: 28 })),
      categoriaId: categoriaPorNome('Rendimentos').id,
      recorrente: false,
      criadoEm: agora(),
      atualizadoEm: agora(),
    })
  }

  if (faker.datatype.boolean(0.35)) {
    entradas.push({
      id: novoId('ent'),
      descricao: 'Reembolso de despesas',
      valor: faker.number.int({ min: 120, max: 900 }),
      data: diaDoPeriodo(periodo, faker.number.int({ min: 10, max: 28 })),
      categoriaId: categoriaPorNome('Reembolso').id,
      recorrente: false,
      criadoEm: agora(),
      atualizadoEm: agora(),
    })
  }

  // --- saídas fixas (categoria "Despesa Fixa"; tipo específico = "Conta")
  const fixas: [string, string, number, number, number][] = [
    ['Aluguel', 'Aluguel do apartamento', 1900, 1900, 10],
    ['Energia', 'Conta de energia', 130, 320, 15],
    ['Água', 'Conta de água', 60, 140, 15],
    ['Internet', 'Internet fibra 500MB', 119, 119, 8],
    ['Plano de Saúde', 'Plano de saúde familiar', 640, 690, 12],
  ]

  for (const [, descricao, min, max, dia] of fixas) {
    saidas.push({
      id: novoId('sai'),
      descricao,
      valor: faker.number.int({ min, max }),
      data: diaDoPeriodo(periodo, dia),
      categoriaId: categoriaPorNome('Despesa Fixa').id,
      tipo: 'CONTA',
      status: offset === 0 && dia > new Date().getDate() ? 'PENDENTE' : 'PAGO',
      formaPagamento: faker.helpers.arrayElement<FormaPagamento>(['PIX', 'BOLETO', 'DEBITO']),
      cartaoId: null,
      recorrente: true,
      criadoEm: agora(),
      atualizadoEm: agora(),
    })
  }

  // --- saídas variáveis (categoria "Despesa Variável"; tipo varia conforme o gasto sorteado)
  const TIPO_POR_GASTO_VARIAVEL: Record<string, SaidaTipo> = {
    Alimentação: 'ALIMENTACAO',
    Transporte: 'TRANSPORTE',
    Lazer: 'LAZER',
    Compras: 'OUTROS',
    Educação: 'OUTROS',
  }
  const variaveis = faker.number.int({ min: 8, max: 14 })
  for (let i = 0; i < variaveis; i += 1) {
    const gasto = faker.helpers.arrayElement([
      'Alimentação',
      'Transporte',
      'Lazer',
      'Compras',
      'Educação',
    ])
    const dia = faker.number.int({ min: 1, max: 28 })
    // Sem CARTAO_CREDITO: gasto no cartão é semeado em `transacoesCartao` e chega
    // na aba Saídas pela fatura (ver `faturasComoSaidas`) — aqui seria contado duas vezes.
    const formaPagamento = faker.helpers.arrayElement<FormaPagamento>(['PIX', 'DEBITO', 'DINHEIRO'])

    saidas.push({
      id: novoId('sai'),
      descricao: descricaoVariavel(gasto),
      valor: faker.number.int({ min: 25, max: 780 }),
      data: diaDoPeriodo(periodo, dia),
      categoriaId: categoriaPorNome('Despesa Variável').id,
      tipo: TIPO_POR_GASTO_VARIAVEL[gasto],
      status: offset === 0 && dia > new Date().getDate() ? 'PENDENTE' : 'PAGO',
      formaPagamento,
      cartaoId: null,
      recorrente: false,
      criadoEm: agora(),
      atualizadoEm: agora(),
    })
  }

  // --- aporte em investimento (categoria "Investimento"; tipo = Poupança ou Ações)
  if (faker.datatype.boolean(0.7)) {
    const aporte = faker.helpers.arrayElement([
      { descricao: 'Aporte Tesouro Direto', tipo: 'ACOES' as const },
      { descricao: 'Compra de ações', tipo: 'ACOES' as const },
      { descricao: 'Aporte na poupança', tipo: 'POUPANCA' as const },
    ])

    saidas.push({
      id: novoId('sai'),
      descricao: aporte.descricao,
      valor: faker.number.int({ min: 300, max: 2500 }),
      data: diaDoPeriodo(periodo, 6),
      categoriaId: categoriaPorNome('Investimento').id,
      tipo: aporte.tipo,
      status: 'PAGO',
      formaPagamento: 'PIX',
      cartaoId: null,
      recorrente: false,
      criadoEm: agora(),
      atualizadoEm: agora(),
    })
  }

  // --- faturas e transações de cartão
  for (const cartao of cartoes) {
    if (!cartao.ativo && offset > 2) continue

    const faturaId = novoId('fat')
    const quantidade = faker.number.int({ min: 4, max: 11 })
    let total = 0

    for (let i = 0; i < quantidade; i += 1) {
      const totalParcelas = faker.helpers.arrayElement([1, 1, 1, 2, 3, 6, 10])
      const valor = faker.number.int({ min: 32, max: 890 })
      total += valor

      transacoesCartao.push({
        id: novoId('trc'),
        cartaoId: cartao.id,
        faturaId,
        descricao: faker.helpers.arrayElement([
          faker.company.name(),
          'Supermercado Real',
          'Posto Ipiranga',
          'Netflix',
          'Spotify',
          'iFood',
          'Amazon',
          'Farmácia São João',
          'Uber',
        ]),
        valor,
        data: diaDoPeriodo(periodo, faker.number.int({ min: 1, max: 28 })),
        categoriaId: categoriaPorNome('Despesa Variável').id,
        tipo: faker.helpers.arrayElement<SaidaTipo>(['ALIMENTACAO', 'TRANSPORTE', 'LAZER', 'OUTROS']),
        parcelaAtual: totalParcelas === 1 ? 1 : faker.number.int({ min: 1, max: totalParcelas }),
        totalParcelas,
        recorrente: false,
        observacao: null,
        criadoEm: agora(),
        atualizadoEm: agora(),
      })
    }

    const vencimento = diaDoPeriodo(periodo, cartao.diaVencimento)
    const venceu = new Date(`${vencimento}T12:00:00`).getTime() < Date.now()

    faturas.push({
      id: faturaId,
      cartaoId: cartao.id,
      competencia: toCompetencia(periodo),
      fechamento: diaDoPeriodo(periodo, cartao.diaFechamento),
      vencimento,
      total,
      status: offset === 0 ? (venceu ? 'ATRASADA' : 'ABERTA') : 'PAGA',
      pagoEm: offset === 0 ? null : vencimento,
    })
  }
}

function descricaoVariavel(categoria: string): string {
  switch (categoria) {
    case 'Alimentação':
      return faker.helpers.arrayElement([
        'Supermercado do mês',
        'Feira da semana',
        'Almoço no trabalho',
        'Padaria',
        'Delivery',
      ])
    case 'Transporte':
      return faker.helpers.arrayElement(['Combustível', 'Aplicativo de corrida', 'Estacionamento', 'Recarga do bilhete'])
    case 'Lazer':
      return faker.helpers.arrayElement(['Cinema', 'Show', 'Jantar fora', 'Assinatura de streaming'])
    case 'Compras':
      return faker.helpers.arrayElement(['Roupas', 'Eletrônico', 'Item para casa', 'Presente'])
    default:
      return faker.helpers.arrayElement(['Curso online', 'Livro técnico', 'Mensalidade do curso'])
  }
}

/**
 * Fatura da competência do cartão, criada como ABERTA na primeira transação do mês —
 * espelha `garantirFatura` do `SupabaseFaturaRepository`.
 */
export function garantirFatura(cartaoId: ID, competencia: string): Fatura {
  const existente = faturas.find(
    (fatura) => fatura.cartaoId === cartaoId && fatura.competencia === competencia,
  )
  if (existente) return existente

  const cartao = cartoes.find((item) => item.id === cartaoId)
  if (!cartao) throw new Error('Cartão não encontrado.')

  const periodo = fromCompetencia(competencia)
  const nova: Fatura = {
    id: novoId('fat'),
    cartaoId,
    competencia,
    fechamento: diaDoPeriodo(periodo, cartao.diaFechamento),
    vencimento: diaDoPeriodo(periodo, cartao.diaVencimento),
    total: 0,
    status: 'ABERTA',
    pagoEm: null,
  }
  faturas.push(nova)
  return nova
}

/** O total da fatura é sempre a soma das transações — evita saldo torto por delta perdido. */
export function recalcularTotalFatura(faturaId: ID): void {
  const fatura = faturas.find((item) => item.id === faturaId)
  if (!fatura) return

  fatura.total = transacoesCartao
    .filter((transacao) => transacao.faturaId === faturaId)
    .reduce((soma, transacao) => soma + transacao.valor, 0)
}

/**
 * Cada cartão com fatura no período vira uma "saída" derivada, com o valor
 * sempre lido ao vivo da fatura — nunca duplicado/armazenado, então qualquer
 * mudança no total da fatura (hoje só via seed; futuramente via lançamentos
 * no cartão) já aparece aqui sem sincronização manual.
 */
function faturasComoSaidas(): Saida[] {
  const categoriaFatura = categoriaPorNome('Despesa Variável')
  return faturas.filter((fatura) => fatura.total > 0).map((fatura) => {
    const cartao = cartoes.find((item) => item.id === fatura.cartaoId)
    return {
      id: `sai_fat_${fatura.id}`,
      descricao: `Fatura – ${cartao?.nome ?? 'Cartão'}`,
      valor: fatura.total,
      data: fatura.vencimento,
      categoriaId: categoriaFatura.id,
      tipo: 'CONTA',
      status: fatura.status === 'PAGA' ? 'PAGO' : 'PENDENTE',
      formaPagamento: 'CARTAO_CREDITO',
      cartaoId: fatura.cartaoId,
      recorrente: true,
      criadoEm: '',
      atualizadoEm: '',
      automatica: true,
    }
  })
}

/** Saídas reais + uma por fatura de cartão do período (ver `faturasComoSaidas`). */
export function saidasComFaturas(): Saida[] {
  return [...saidas, ...faturasComoSaidas()]
}

/** Data ISO de hoje — usada como valor padrão nos formulários. */
export const hojeISO = toISODate(new Date())

function periodoDaData(iso: string): Periodo {
  const data = toDate(iso)
  return { mes: data.getMonth() + 1, ano: data.getFullYear() }
}

function ordinalDoPeriodo(periodo: Periodo): number {
  return periodo.ano * 12 + periodo.mes
}

/**
 * Projeta, para um período-alvo, a ocorrência de cada série recorrente (agrupada
 * por descrição + categoria) que ainda não tenha lançamento real naquele período —
 * nunca persiste, recalcula a cada leitura a partir da ocorrência real mais recente
 * da série. Assim, desligar `recorrente` no original (ou editar seu valor) já
 * reflete nos meses seguintes sozinho, sem nada pra apagar/sincronizar; e um mês que
 * já tem lançamento próprio (histórico real, ou editado à mão) não é duplicado.
 * `automatica` (fatura de cartão) fica de fora: aquelas já são geradas por período
 * pelo mecanismo de faturas.
 */
export function comRecorrencias<
  T extends {
    id: ID
    data: string
    descricao: string
    categoriaId: ID
    recorrente: boolean
    origemRecorrenciaId?: ID
    automatica?: boolean
  },
>(itens: T[], periodoAlvo: Periodo): T[] {
  const alvo = ordinalDoPeriodo(periodoAlvo)
  const chaveDaSerie = (item: T) => `${item.descricao}::${item.categoriaId}`

  const mesesJaLancados = new Set(
    itens
      .filter((item) => ordinalDoPeriodo(periodoDaData(item.data)) === alvo)
      .map(chaveDaSerie),
  )

  const maisRecentePorSerie = new Map<string, T>()
  for (const item of itens) {
    if (!item.recorrente || item.origemRecorrenciaId || item.automatica) continue
    if (ordinalDoPeriodo(periodoDaData(item.data)) >= alvo) continue

    const chave = chaveDaSerie(item)
    const atual = maisRecentePorSerie.get(chave)
    if (!atual || item.data > atual.data) maisRecentePorSerie.set(chave, item)
  }

  const projetadas = [...maisRecentePorSerie.entries()]
    .filter(([chave]) => !mesesJaLancados.has(chave))
    .map(([, origem]) => ({
      ...origem,
      id: `${origem.id}_${toCompetencia(periodoAlvo)}`,
      data: diaDoPeriodo(periodoAlvo, toDate(origem.data).getDate()),
      origemRecorrenciaId: origem.id,
    }))

  return [...itens, ...projetadas]
}
