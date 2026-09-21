import { beforeEach, describe, expect, it } from 'vitest'

import {
  cartoes,
  comRecorrencias,
  faturas,
  garantirFatura,
  origemDoIdProjetado,
  recalcularTotalFatura,
  saidas,
  saidasComFaturas,
  transacoesCartao,
} from '@/services/mock/db'
import type { TransacaoCartao } from '@/types/cartao'
import type { Saida } from '@/types/saida'

interface Item {
  id: string
  data: string
  descricao: string
  categoriaId: string
  recorrente: boolean
  valor: number
  origemRecorrenciaId?: string
  automatica?: boolean
  vencimento?: string | null
  status?: string
  pagoEm?: string | null
}

function item(sobrescritas: Partial<Item> = {}): Item {
  return {
    id: 'sai_1',
    data: '2026-01-15',
    descricao: 'Aluguel',
    categoriaId: 'cat_1',
    recorrente: true,
    valor: 100,
    ...sobrescritas,
  }
}

function transacao(faturaId: string, valor: number, id: string): TransacaoCartao {
  return {
    id,
    cartaoId: cartoes[0]!.id,
    faturaId,
    descricao: 'Compra',
    valor,
    data: '2026-08-10',
    categoriaId: 'cat_1',
    tipo: 'OUTROS',
    parcelaAtual: 1,
    totalParcelas: 1,
    recorrente: false,
    observacao: null,
    criadoEm: '',
    atualizadoEm: '',
  }
}

beforeEach(() => {
  saidas.length = 0
  faturas.length = 0
  transacoesCartao.length = 0
})

describe('comRecorrencias', () => {
  it('projeta a ocorrência do mês seguinte a partir de uma série recorrente', () => {
    const origem = item({ vencimento: '2026-01-10' })
    const resultado = comRecorrencias([origem], { mes: 2, ano: 2026 })

    expect(resultado).toHaveLength(2)
    const projetada = resultado[1]!
    expect(projetada.id).toBe('sai_1_2026-02')
    expect(projetada.data).toBe('2026-02-15')
    expect(projetada.vencimento).toBe('2026-02-10')
    expect(projetada.origemRecorrenciaId).toBe('sai_1')
    expect(projetada.descricao).toBe('Aluguel')
    expect(projetada.valor).toBe(100)
  })

  it('não duplica quando o mês já tem lançamento da mesma série', () => {
    const real = item({ id: 'sai_2', data: '2026-02-20', valor: 150 })
    const resultado = comRecorrencias([item(), real], { mes: 2, ano: 2026 })

    expect(resultado).toHaveLength(2)
    expect(resultado.filter((i) => i.origemRecorrenciaId)).toHaveLength(0)
  })

  it('projeta quando o lançamento do mês pertence a outra série', () => {
    const outraSerie = item({ id: 'sai_2', data: '2026-02-20', descricao: 'Internet' })
    const resultado = comRecorrencias([item(), outraSerie], { mes: 2, ano: 2026 })

    expect(resultado.map((i) => i.id)).toContain('sai_1_2026-02')
  })

  it('não projeta para o mês da origem nem para meses anteriores', () => {
    const itens = [item()]
    expect(comRecorrencias(itens, { mes: 1, ano: 2026 })).toEqual(itens)
    expect(comRecorrencias(itens, { mes: 12, ano: 2025 })).toEqual(itens)
  })

  it('ignora itens automáticos (faturas)', () => {
    const itens = [item({ automatica: true })]
    expect(comRecorrencias(itens, { mes: 2, ano: 2026 })).toEqual(itens)
  })

  it('ignora itens que já são projeção', () => {
    const itens = [item({ origemRecorrenciaId: 'sai_0' })]
    expect(comRecorrencias(itens, { mes: 2, ano: 2026 })).toEqual(itens)
  })

  it('nunca projeta item com recorrente false', () => {
    const itens = [item({ recorrente: false })]
    expect(comRecorrencias(itens, { mes: 2, ano: 2026 })).toEqual(itens)
  })

  it('usa a ocorrência real mais recente da série como base', () => {
    const antiga = item({ id: 'sai_1', data: '2026-01-05', valor: 100 })
    const recente = item({ id: 'sai_3', data: '2026-03-08', valor: 300 })
    const resultado = comRecorrencias([antiga, recente], { mes: 4, ano: 2026 })

    const projetadas = resultado.filter((i) => i.origemRecorrenciaId)
    expect(projetadas).toHaveLength(1)
    expect(projetadas[0]).toMatchObject({
      id: 'sai_3_2026-04',
      data: '2026-04-08',
      valor: 300,
      origemRecorrenciaId: 'sai_3',
    })
  })

  it('limita dia 31 ao último dia do mês curto, em data e vencimento', () => {
    const origem = item({ data: '2026-01-31', vencimento: '2026-01-31' })

    const fevereiro = comRecorrencias([origem], { mes: 2, ano: 2026 })[1]!
    expect(fevereiro.data).toBe('2026-02-28')
    expect(fevereiro.vencimento).toBe('2026-02-28')

    const abril = comRecorrencias([origem], { mes: 4, ano: 2026 })[1]!
    expect(abril.data).toBe('2026-04-30')
    expect(abril.vencimento).toBe('2026-04-30')

    const marco = comRecorrencias([origem], { mes: 3, ano: 2026 })[1]!
    expect(marco.data).toBe('2026-03-31')
  })

  it('não cria vencimento nem status quando o item não tem (entradas)', () => {
    const projetada = comRecorrencias([item()], { mes: 2, ano: 2026 })[1]!
    expect('vencimento' in projetada).toBe(false)
    expect('status' in projetada).toBe(false)
  })

  it('a projeção de saída começa pendente, sem herdar o pagamento da origem', () => {
    const origem = item({ status: 'PAGO', pagoEm: '2026-01-15' })
    const projetada = comRecorrencias([origem], { mes: 2, ano: 2026 })[1]!

    expect(projetada.status).toBe('PENDENTE')
    expect(projetada.pagoEm).toBeNull()
  })

  it('não muta os dados de entrada e é determinístico', () => {
    const itens = [item({ vencimento: '2026-01-10', status: 'PAGO', pagoEm: '2026-01-15' })]
    const copia = structuredClone(itens)

    const primeira = comRecorrencias(itens, { mes: 3, ano: 2026 })
    const segunda = comRecorrencias(itens, { mes: 3, ano: 2026 })

    expect(itens).toEqual(copia)
    expect(primeira).toEqual(segunda)
    expect(primeira).toHaveLength(2)
  })
})

describe('origemDoIdProjetado', () => {
  it('extrai origem e competência de um id projetado', () => {
    expect(origemDoIdProjetado('sai_00001_2026-02')).toEqual({
      origemId: 'sai_00001',
      competencia: '2026-02',
    })
  })

  it.each(['sai_00001', 'sai_fat_fat_00001', ''])('devolve null para id comum %j', (id) => {
    expect(origemDoIdProjetado(id)).toBeNull()
  })
})

describe('garantirFatura', () => {
  it('cria fatura ABERTA com fechamento e vencimento do cartão', () => {
    const cartao = cartoes[0]!
    const fatura = garantirFatura(cartao.id, '2026-08')

    expect(fatura).toMatchObject({
      cartaoId: cartao.id,
      competencia: '2026-08',
      fechamento: '2026-08-20',
      vencimento: '2026-08-27',
      total: 0,
      status: 'ABERTA',
      pagoEm: null,
    })
    expect(faturas).toContain(fatura)
  })

  it('reutiliza a fatura existente da competência', () => {
    const cartaoId = cartoes[0]!.id
    const primeira = garantirFatura(cartaoId, '2026-08')
    const segunda = garantirFatura(cartaoId, '2026-08')

    expect(segunda).toBe(primeira)
    expect(faturas).toHaveLength(1)
  })

  it('cria faturas distintas para competências e cartões distintos', () => {
    garantirFatura(cartoes[0]!.id, '2026-08')
    garantirFatura(cartoes[0]!.id, '2026-09')
    garantirFatura(cartoes[1]!.id, '2026-08')

    expect(faturas).toHaveLength(3)
  })

  it('lança erro para cartão inexistente', () => {
    expect(() => garantirFatura('car_inexistente', '2026-08')).toThrow('Cartão não encontrado.')
  })
})

describe('recalcularTotalFatura', () => {
  it('soma apenas as transações da fatura', () => {
    const fatura = garantirFatura(cartoes[0]!.id, '2026-08')
    const outra = garantirFatura(cartoes[0]!.id, '2026-09')
    transacoesCartao.push(
      transacao(fatura.id, 100, 'trc_1'),
      transacao(fatura.id, 50.5, 'trc_2'),
      transacao(outra.id, 999, 'trc_3'),
    )

    recalcularTotalFatura(fatura.id)

    expect(fatura.total).toBe(150.5)
    expect(outra.total).toBe(0)
  })

  it('zera a fatura sem transações', () => {
    const fatura = garantirFatura(cartoes[0]!.id, '2026-08')
    fatura.total = 500

    recalcularTotalFatura(fatura.id)

    expect(fatura.total).toBe(0)
  })

  it('não lança para id inexistente', () => {
    expect(() => recalcularTotalFatura('fat_inexistente')).not.toThrow()
  })
})

describe('saidasComFaturas', () => {
  it('transforma fatura com total em saída automática pendente no cartão', () => {
    const cartao = cartoes[0]!
    const fatura = garantirFatura(cartao.id, '2026-08')
    fatura.total = 320

    const derivada = saidasComFaturas().find((s) => s.id === `sai_fat_${fatura.id}`)!

    expect(derivada).toMatchObject({
      descricao: `Fatura – ${cartao.nome}`,
      valor: 320,
      data: fatura.vencimento,
      vencimento: fatura.vencimento,
      status: 'PENDENTE',
      pagoEm: null,
      formaPagamento: 'CARTAO_CREDITO',
      cartaoId: cartao.id,
      automatica: true,
    })
  })

  it('marca como PAGO quando a fatura está paga', () => {
    const fatura = garantirFatura(cartoes[0]!.id, '2026-08')
    fatura.total = 320
    fatura.status = 'PAGA'
    fatura.pagoEm = '2026-08-27'

    const derivada = saidasComFaturas().find((s) => s.automatica)!

    expect(derivada.status).toBe('PAGO')
    expect(derivada.pagoEm).toBe('2026-08-27')
  })

  it('mantém fatura atrasada como pendente', () => {
    const fatura = garantirFatura(cartoes[0]!.id, '2026-08')
    fatura.total = 320
    fatura.status = 'ATRASADA'

    expect(saidasComFaturas().find((s) => s.automatica)!.status).toBe('PENDENTE')
  })

  it('omite fatura com total zero', () => {
    garantirFatura(cartoes[0]!.id, '2026-08')

    expect(saidasComFaturas()).toEqual([])
  })

  it('inclui as saídas reais antes das derivadas', () => {
    const real = { id: 'sai_real' } as Saida
    saidas.push(real)
    const fatura = garantirFatura(cartoes[0]!.id, '2026-08')
    fatura.total = 10

    const resultado = saidasComFaturas()

    expect(resultado).toHaveLength(2)
    expect(resultado[0]).toBe(real)
    expect(resultado[1]!.automatica).toBe(true)
  })
})
