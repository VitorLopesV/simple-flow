import { beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { dashboardService } from '@/services/dashboardService'
import { mockDb } from '@/services/mock'
import type { Cartao } from '@/types/cartao'
import type { Entrada } from '@/types/entrada'
import type { Saida } from '@/types/saida'

type Db = Awaited<ReturnType<typeof mockDb>>

const AGOSTO = { mes: 8, ano: 2026 }
const COR_PADRAO = '#94a3b8'

let db: Db
let catA: { id: string; nome: string; cor: string }
let catB: { id: string; nome: string; cor: string }

let sequencia = 0

function entrada(sobrescritas: Partial<Entrada> = {}): Entrada {
  sequencia += 1
  return {
    id: `ent_teste_${sequencia}`,
    descricao: 'Salário',
    valor: 100,
    data: '2026-08-05',
    categoriaId: catA.id,
    recorrente: false,
    criadoEm: '',
    atualizadoEm: '',
    ...sobrescritas,
  }
}

function saida(sobrescritas: Partial<Saida> = {}): Saida {
  sequencia += 1
  return {
    id: `sai_teste_${sequencia}`,
    descricao: 'Conta',
    valor: 100,
    data: '2026-08-10',
    categoriaId: catA.id,
    tipo: 'CONTA',
    status: 'PENDENTE',
    vencimento: null,
    pagoEm: null,
    formaPagamento: 'PIX',
    cartaoId: null,
    recorrente: false,
    criadoEm: '',
    atualizadoEm: '',
    ...sobrescritas,
  }
}

function cartao(): Cartao {
  return {
    id: 'car_a',
    nome: 'Alfa',
    bandeira: 'VISA',
    ultimosDigitos: '1111',
    limite: 1000,
    diaFechamento: 20,
    diaVencimento: 27,
    cor: '#000000',
    ativo: true,
    criadoEm: '',
  }
}

beforeEach(async () => {
  db = await mockDb()
  db.entradas.length = 0
  db.saidas.length = 0
  db.faturas.length = 0
  db.transacoesCartao.length = 0
  db.cartoes.length = 0
  db.cartoes.push(cartao())
  catA = db.categorias[0]!
  catB = db.categorias[1]!
})

describe('totais do período', () => {
  it('calcula totalEntradas, totalSaidas e saldo apenas do mês', async () => {
    db.entradas.push(
      entrada({ valor: 1000 }),
      entrada({ valor: 500 }),
      entrada({ valor: 999, data: '2026-07-31' }),
      entrada({ valor: 999, data: '2026-09-01' }),
    )
    db.saidas.push(
      saida({ valor: 300 }),
      saida({ valor: 200 }),
      saida({ valor: 700, categoriaId: catB.id }),
      saida({ valor: 999, data: '2026-07-31' }),
    )

    const resumo = await dashboardService.resumo(AGOSTO)

    expect(resumo.totalEntradas).toBe(1500)
    expect(resumo.totalSaidas).toBe(1200)
    expect(resumo.saldo).toBe(300)
  })

  it('saldo negativo quando as saídas superam as entradas', async () => {
    db.entradas.push(entrada({ valor: 100 }))
    db.saidas.push(saida({ valor: 350 }))

    const resumo = await dashboardService.resumo(AGOSTO)

    expect(resumo.saldo).toBe(-250)
  })
})

describe('séries', () => {
  beforeEach(() => {
    db.entradas.push(
      entrada({ valor: 1000 }),
      entrada({ valor: 500 }),
      entrada({ valor: 600, data: '2026-07-10' }),
      entrada({ valor: 200, data: '2026-03-15' }),
      entrada({ valor: 999, data: '2026-02-28' }),
    )
    db.saidas.push(
      saida({ valor: 1200 }),
      saida({ valor: 400, data: '2026-07-20' }),
      saida({ valor: 50, data: '2026-06-01' }),
      saida({ valor: 999, data: '2026-02-28' }),
    )
  })

  it('tem 6 pontos, do mais antigo ao atual, com labels mmm/aa', async () => {
    const { serieEntradas, serieSaidas } = await dashboardService.resumo(AGOSTO)

    const labels = ['mar/26', 'abr/26', 'mai/26', 'jun/26', 'jul/26', 'ago/26']
    expect(serieEntradas.map((p) => p.label)).toEqual(labels)
    expect(serieSaidas.map((p) => p.label)).toEqual(labels)
  })

  it('soma cada mês e usa 0 nos meses sem movimento', async () => {
    const { serieEntradas, serieSaidas } = await dashboardService.resumo(AGOSTO)

    expect(serieEntradas.map((p) => p.valor)).toEqual([200, 0, 0, 0, 600, 1500])
    expect(serieSaidas.map((p) => p.valor)).toEqual([0, 0, 0, 50, 400, 1200])
  })

  it('atravessa a virada de ano', async () => {
    const { serieEntradas } = await dashboardService.resumo({ mes: 2, ano: 2027 })

    expect(serieEntradas.map((p) => p.label)).toEqual([
      'set/26',
      'out/26',
      'nov/26',
      'dez/26',
      'jan/27',
      'fev/27',
    ])
  })
})

describe('variação', () => {
  it('compara com o mês anterior', async () => {
    db.entradas.push(entrada({ valor: 1500 }), entrada({ valor: 600, data: '2026-07-10' }))
    db.saidas.push(saida({ valor: 1200 }), saida({ valor: 400, data: '2026-07-20' }))

    const resumo = await dashboardService.resumo(AGOSTO)

    expect(resumo.variacaoEntradas).toBe(1.5)
    expect(resumo.variacaoSaidas).toBe(2)
  })

  it('variação negativa quando o mês cai', async () => {
    db.entradas.push(entrada({ valor: 300 }), entrada({ valor: 600, data: '2026-07-10' }))

    const resumo = await dashboardService.resumo(AGOSTO)

    expect(resumo.variacaoEntradas).toBe(-0.5)
  })

  it('mês anterior zerado vira 1 se houve movimento e 0 se não houve', async () => {
    db.entradas.push(entrada({ valor: 100 }))

    const resumo = await dashboardService.resumo(AGOSTO)

    expect(resumo.variacaoEntradas).toBe(1)
    expect(resumo.variacaoSaidas).toBe(0)
  })
})

describe('totalFaturas', () => {
  it('soma só as saídas automáticas de cartão do mês', async () => {
    const faturaAgo = db.garantirFatura('car_a', '2026-08')
    faturaAgo.total = 450
    const faturaSet = db.garantirFatura('car_a', '2026-09')
    faturaSet.total = 999
    db.saidas.push(
      saida({ valor: 200 }),
      // Cartão de crédito, mas não é fatura derivada: não entra em totalFaturas.
      saida({ valor: 80, formaPagamento: 'CARTAO_CREDITO' }),
    )

    const resumo = await dashboardService.resumo(AGOSTO)

    expect(resumo.totalFaturas).toBe(450)
    expect(resumo.totalSaidas).toBe(200 + 80 + 450)
  })

  it('é 0 sem faturas no mês', async () => {
    db.saidas.push(saida({ valor: 200 }))

    const resumo = await dashboardService.resumo(AGOSTO)

    expect(resumo.totalFaturas).toBe(0)
  })
})

describe('gastosPorCategoria', () => {
  it('agrupa por categoria, ordena do maior para o menor e cai em "Outros" para categoria desconhecida', async () => {
    db.saidas.push(
      saida({ valor: 300, categoriaId: catA.id }),
      saida({ valor: 200, categoriaId: catA.id }),
      saida({ valor: 700, categoriaId: catB.id }),
      saida({ valor: 100, categoriaId: 'cat_inexistente' }),
      saida({ valor: 999, categoriaId: catB.id, data: '2026-07-10' }),
    )

    const { gastosPorCategoria } = await dashboardService.resumo(AGOSTO)

    expect(gastosPorCategoria).toEqual([
      { nome: catB.nome, cor: catB.cor, total: 700 },
      { nome: catA.nome, cor: catA.cor, total: 500 },
      { nome: 'Outros', cor: COR_PADRAO, total: 100 },
    ])
  })

  it('soma dos gastos por categoria é igual ao total de saídas', async () => {
    db.saidas.push(saida({ valor: 300 }), saida({ valor: 700, categoriaId: catB.id }))
    db.garantirFatura('car_a', '2026-08').total = 450

    const resumo = await dashboardService.resumo(AGOSTO)

    const soma = resumo.gastosPorCategoria.reduce((acc, g) => acc + g.total, 0)
    expect(soma).toBe(resumo.totalSaidas)
    expect(resumo.totalSaidas).toBe(1450)
  })
})

describe('transacoesRecentes', () => {
  it('mistura entradas e saídas do mês, da data mais recente para a mais antiga, no máximo 8', async () => {
    for (let dia = 1; dia <= 5; dia += 1) {
      db.entradas.push(entrada({ id: `e${dia}`, data: `2026-08-0${dia}` }))
    }
    for (let dia = 6; dia <= 10; dia += 1) {
      const data = dia === 10 ? '2026-08-10' : `2026-08-0${dia}`
      db.saidas.push(saida({ id: `s${dia}`, data }))
    }
    db.entradas.push(entrada({ id: 'fora', data: '2026-07-31' }))

    const { transacoesRecentes } = await dashboardService.resumo(AGOSTO)

    expect(transacoesRecentes).toHaveLength(8)
    expect(transacoesRecentes.map((t) => t.id)).toEqual(['s10', 's9', 's8', 's7', 's6', 'e5', 'e4', 'e3'])
    expect(transacoesRecentes.map((t) => t.tipo)).toEqual([
      'SAIDA',
      'SAIDA',
      'SAIDA',
      'SAIDA',
      'SAIDA',
      'ENTRADA',
      'ENTRADA',
      'ENTRADA',
    ])
  })

  it('traz nome e cor da categoria, com "Sem categoria" e cor padrão para desconhecida', async () => {
    db.entradas.push(entrada({ id: 'e1', categoriaId: catA.id, data: '2026-08-02' }))
    db.saidas.push(saida({ id: 's1', categoriaId: 'cat_inexistente', data: '2026-08-01' }))

    const { transacoesRecentes } = await dashboardService.resumo(AGOSTO)

    expect(transacoesRecentes[0]).toMatchObject({
      id: 'e1',
      tipo: 'ENTRADA',
      categoriaNome: catA.nome,
      categoriaCor: catA.cor,
    })
    expect(transacoesRecentes[1]).toMatchObject({
      id: 's1',
      tipo: 'SAIDA',
      categoriaNome: 'Sem categoria',
      categoriaCor: COR_PADRAO,
    })
  })

  it('inclui a fatura de cartão do mês como saída', async () => {
    db.garantirFatura('car_a', '2026-08').total = 450

    const { transacoesRecentes } = await dashboardService.resumo(AGOSTO)

    expect(transacoesRecentes).toHaveLength(1)
    expect(transacoesRecentes[0]).toMatchObject({ tipo: 'SAIDA', valor: 450, descricao: 'Fatura – Alfa' })
  })
})

describe('período sem dados', () => {
  it('devolve zeros e listas vazias, sem lançar', async () => {
    const resumo = await dashboardService.resumo(AGOSTO)

    expect(resumo).toMatchObject({
      totalEntradas: 0,
      totalSaidas: 0,
      saldo: 0,
      totalFaturas: 0,
      variacaoEntradas: 0,
      variacaoSaidas: 0,
      gastosPorCategoria: [],
      transacoesRecentes: [],
    })
    expect(resumo.serieEntradas).toHaveLength(6)
    expect(resumo.serieSaidas).toHaveLength(6)
    expect(resumo.serieEntradas.every((p) => p.valor === 0)).toBe(true)
    expect(resumo.serieSaidas.every((p) => p.valor === 0)).toBe(true)
  })
})
