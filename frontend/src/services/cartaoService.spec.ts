import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { cartaoService } from '@/services/cartaoService'
import { mockDb } from '@/services/mock'
import type { Cartao, CartaoPayload, TransacaoCartaoPayload } from '@/types/cartao'

type Db = Awaited<ReturnType<typeof mockDb>>

const PERIODO_AGO = { mes: 8, ano: 2026 }

let db: Db

function cartao(sobrescritas: Partial<Cartao> = {}): Cartao {
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
    criadoEm: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

function payloadCartao(sobrescritas: Partial<CartaoPayload> = {}): CartaoPayload {
  return {
    nome: 'Novo',
    bandeira: 'MASTERCARD',
    ultimosDigitos: '9999',
    limite: 500,
    diaFechamento: 10,
    diaVencimento: 17,
    cor: '#ffffff',
    ativo: true,
    ...sobrescritas,
  }
}

function payloadTransacao(sobrescritas: Partial<TransacaoCartaoPayload> = {}): TransacaoCartaoPayload {
  return {
    descricao: 'Compra',
    valor: 100,
    data: '2026-08-10',
    categoriaId: 'cat_1',
    tipo: 'OUTROS',
    parcelaAtual: 1,
    totalParcelas: 1,
    recorrente: false,
    observacao: null,
    ...sobrescritas,
  }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-27T12:00:00Z'))

  db = await mockDb()
  db.cartoes.length = 0
  db.cartoes.push(
    cartao({ id: 'car_a', nome: 'Alfa', limite: 1000 }),
    cartao({ id: 'car_b', nome: 'Beta', limite: 0 }),
  )
  db.faturas.length = 0
  db.transacoesCartao.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('listar', () => {
  it('devolve ativos primeiro e depois em ordem alfabética', async () => {
    db.cartoes.length = 0
    db.cartoes.push(
      cartao({ id: '1', nome: 'Zeta', ativo: true }),
      cartao({ id: '2', nome: 'Beta', ativo: false }),
      cartao({ id: '3', nome: 'Água', ativo: true }),
      cartao({ id: '4', nome: 'Aaa', ativo: false }),
    )

    const resultado = await cartaoService.listar()

    expect(resultado.map((c) => c.nome)).toEqual(['Água', 'Zeta', 'Aaa', 'Beta'])
  })

  it('devolve cópias e não reordena o banco', async () => {
    db.cartoes.length = 0
    db.cartoes.push(cartao({ id: '1', nome: 'Zeta' }), cartao({ id: '2', nome: 'Alfa' }))

    const resultado = await cartaoService.listar()
    resultado[0]!.nome = 'Alterado'

    expect(db.cartoes.map((c) => c.nome)).toEqual(['Zeta', 'Alfa'])
  })
})

describe('listarComFaturas', () => {
  it('combina cartão e fatura da competência, com uso do limite em percentual', async () => {
    await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 100 }))
    await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 150 }))

    const resultado = await cartaoService.listarComFaturas({ periodo: PERIODO_AGO })
    const alfa = resultado.find((r) => r.cartao.id === 'car_a')!

    expect(alfa.fatura).not.toBeNull()
    expect(alfa.fatura!.competencia).toBe('2026-08')
    expect(alfa.fatura!.total).toBe(250)
    expect(alfa.fatura!.transacoes).toHaveLength(2)
    expect(alfa.usoLimite).toBe(25)
  })

  it('devolve fatura null e uso 0 quando o cartão não tem fatura na competência', async () => {
    await cartaoService.criarTransacao('car_a', payloadTransacao({ data: '2026-07-10' }))

    const resultado = await cartaoService.listarComFaturas({ periodo: PERIODO_AGO })
    const alfa = resultado.find((r) => r.cartao.id === 'car_a')!

    expect(alfa.fatura).toBeNull()
    expect(alfa.usoLimite).toBe(0)
  })

  it('usoLimite é 0 quando o limite do cartão é 0', async () => {
    await cartaoService.criarTransacao('car_b', payloadTransacao({ valor: 300 }))

    const resultado = await cartaoService.listarComFaturas({ periodo: PERIODO_AGO })
    const beta = resultado.find((r) => r.cartao.id === 'car_b')!

    expect(beta.fatura!.total).toBe(300)
    expect(beta.usoLimite).toBe(0)
  })

  it('filtra por cartaoId', async () => {
    const resultado = await cartaoService.listarComFaturas({ periodo: PERIODO_AGO, cartaoId: 'car_b' })

    expect(resultado.map((r) => r.cartao.id)).toEqual(['car_b'])
  })

  it('ordena as transações da fatura por data decrescente', async () => {
    await cartaoService.criarTransacao('car_a', payloadTransacao({ descricao: 'meio', data: '2026-08-10' }))
    await cartaoService.criarTransacao('car_a', payloadTransacao({ descricao: 'nova', data: '2026-08-25' }))
    await cartaoService.criarTransacao('car_a', payloadTransacao({ descricao: 'velha', data: '2026-08-01' }))

    const [alfa] = await cartaoService.listarComFaturas({ periodo: PERIODO_AGO, cartaoId: 'car_a' })

    expect(alfa!.fatura!.transacoes.map((t) => t.descricao)).toEqual(['nova', 'meio', 'velha'])
  })

  it('ordena cartões ativos primeiro e depois alfabeticamente', async () => {
    db.cartoes.length = 0
    db.cartoes.push(
      cartao({ id: '1', nome: 'Zeta', ativo: true }),
      cartao({ id: '2', nome: 'Aaa', ativo: false }),
      cartao({ id: '3', nome: 'Alfa', ativo: true }),
    )

    const resultado = await cartaoService.listarComFaturas({ periodo: PERIODO_AGO })

    expect(resultado.map((r) => r.cartao.nome)).toEqual(['Alfa', 'Zeta', 'Aaa'])
  })

  it('devolve cópias: alterar o resultado não muda o banco', async () => {
    await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 100 }))

    const [alfa] = await cartaoService.listarComFaturas({ periodo: PERIODO_AGO, cartaoId: 'car_a' })
    alfa!.fatura!.total = 999
    alfa!.cartao.nome = 'Alterado'

    expect(db.faturas[0]!.total).toBe(100)
    expect(db.cartoes[0]!.nome).toBe('Alfa')
  })
})

describe('criar / atualizar', () => {
  it('criar gera id e criadoEm e persiste', async () => {
    const criado = await cartaoService.criar(payloadCartao({ nome: 'Gama' }))

    expect(criado.id).toMatch(/^car_\d+$/)
    expect(criado.criadoEm).toBe('2026-08-27T12:00:00.000Z')
    expect(criado.nome).toBe('Gama')
    expect(db.cartoes).toHaveLength(3)
    expect(db.cartoes[2]).toEqual(criado)
    expect(db.cartoes[2]).not.toBe(criado)
  })

  it('atualizar aplica o payload preservando id e criadoEm', async () => {
    const atualizado = await cartaoService.atualizar('car_a', payloadCartao({ nome: 'Renomeado', limite: 42 }))

    expect(atualizado.id).toBe('car_a')
    expect(atualizado.criadoEm).toBe('2026-01-01T00:00:00.000Z')
    expect(atualizado.nome).toBe('Renomeado')
    expect(atualizado.limite).toBe(42)
    expect(db.cartoes[0]).toEqual(atualizado)
  })

  it('atualizar cartão inexistente rejeita com "Cartão não encontrado."', async () => {
    await expect(cartaoService.atualizar('car_x', payloadCartao())).rejects.toThrow('Cartão não encontrado.')
  })
})

describe('remover', () => {
  it('exclui o cartão, suas faturas e suas transações, sem deixar órfãs', async () => {
    await cartaoService.criarTransacao('car_a', payloadTransacao({ data: '2026-08-10' }))
    await cartaoService.criarTransacao('car_a', payloadTransacao({ data: '2026-09-10' }))
    await cartaoService.criarTransacao('car_b', payloadTransacao({ data: '2026-08-10', valor: 70 }))

    await cartaoService.remover('car_a')

    expect(db.cartoes.map((c) => c.id)).toEqual(['car_b'])
    expect(db.faturas.map((f) => f.cartaoId)).toEqual(['car_b'])
    expect(db.transacoesCartao.map((t) => t.cartaoId)).toEqual(['car_b'])
    expect(db.transacoesCartao[0]!.valor).toBe(70)
  })

  it('cartão inexistente rejeita com "Cartão não encontrado."', async () => {
    await expect(cartaoService.remover('car_x')).rejects.toThrow('Cartão não encontrado.')
  })
})

describe('criarTransacao', () => {
  it('cria a fatura ABERTA da competência da data e vincula a transação', async () => {
    const transacao = await cartaoService.criarTransacao('car_a', payloadTransacao({ data: '2026-09-15', valor: 80 }))

    expect(db.faturas).toHaveLength(1)
    const fatura = db.faturas[0]!
    expect(fatura).toMatchObject({
      cartaoId: 'car_a',
      competencia: '2026-09',
      fechamento: '2026-09-20',
      vencimento: '2026-09-27',
      status: 'ABERTA',
      pagoEm: null,
    })
    expect(transacao.faturaId).toBe(fatura.id)
    expect(transacao.cartaoId).toBe('car_a')
    expect(transacao.id).toMatch(/^trc_\d+$/)
    expect(fatura.total).toBe(80)
  })

  it('reutiliza a fatura existente e soma o total', async () => {
    await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 80, data: '2026-08-01' }))
    await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 20.5, data: '2026-08-28' }))

    expect(db.faturas).toHaveLength(1)
    expect(db.faturas[0]!.total).toBe(100.5)
    expect(db.transacoesCartao).toHaveLength(2)
  })

  it('cartão inexistente rejeita com "Cartão não encontrado." sem criar nada', async () => {
    await expect(cartaoService.criarTransacao('car_x', payloadTransacao())).rejects.toThrow('Cartão não encontrado.')

    expect(db.faturas).toHaveLength(0)
    expect(db.transacoesCartao).toHaveLength(0)
  })
})

describe('atualizarTransacao', () => {
  it('mudar a data para outra competência move a transação e recalcula os dois totais', async () => {
    const movida = await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 100, data: '2026-08-10' }))
    await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 50, data: '2026-08-12' }))
    const faturaAgo = db.faturas.find((f) => f.competencia === '2026-08')!
    expect(faturaAgo.total).toBe(150)

    const atualizada = await cartaoService.atualizarTransacao(
      'car_a',
      movida.id,
      payloadTransacao({ valor: 100, data: '2026-09-05' }),
    )

    const faturaSet = db.faturas.find((f) => f.competencia === '2026-09')!
    expect(atualizada.faturaId).toBe(faturaSet.id)
    expect(faturaAgo.total).toBe(50)
    expect(faturaSet.total).toBe(100)
    expect(db.faturas).toHaveLength(2)
  })

  it('mover para uma fatura já existente soma nela e tira da anterior', async () => {
    const movida = await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 100, data: '2026-08-10' }))
    await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 40, data: '2026-09-10' }))

    await cartaoService.atualizarTransacao('car_a', movida.id, payloadTransacao({ valor: 100, data: '2026-09-20' }))

    expect(db.faturas.find((f) => f.competencia === '2026-08')!.total).toBe(0)
    expect(db.faturas.find((f) => f.competencia === '2026-09')!.total).toBe(140)
  })

  it('mesma competência recalcula o total sem contar em dobro', async () => {
    const transacao = await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 100, data: '2026-08-10' }))
    await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 50, data: '2026-08-12' }))

    const atualizada = await cartaoService.atualizarTransacao(
      'car_a',
      transacao.id,
      payloadTransacao({ valor: 300, data: '2026-08-15', descricao: 'Editada' }),
    )

    expect(db.faturas).toHaveLength(1)
    expect(db.faturas[0]!.total).toBe(350)
    expect(atualizada.faturaId).toBe(db.faturas[0]!.id)
    expect(atualizada.descricao).toBe('Editada')
    expect(atualizada.id).toBe(transacao.id)
    expect(atualizada.criadoEm).toBe(transacao.criadoEm)
  })

  it('transação inexistente rejeita com "Transação não encontrada."', async () => {
    await expect(cartaoService.atualizarTransacao('car_a', 'trc_x', payloadTransacao())).rejects.toThrow(
      'Transação não encontrada.',
    )
  })
})

describe('removerTransacao', () => {
  it('remove a transação e recalcula o total da fatura', async () => {
    const primeira = await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 100 }))
    await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 50 }))

    await cartaoService.removerTransacao('car_a', primeira.id)

    expect(db.transacoesCartao).toHaveLength(1)
    expect(db.faturas[0]!.total).toBe(50)
  })

  it('remover a última transação zera o total', async () => {
    const unica = await cartaoService.criarTransacao('car_a', payloadTransacao({ valor: 100 }))

    await cartaoService.removerTransacao('car_a', unica.id)

    expect(db.faturas[0]!.total).toBe(0)
  })

  it('transação inexistente rejeita com "Transação não encontrada."', async () => {
    await expect(cartaoService.removerTransacao('car_a', 'trc_x')).rejects.toThrow('Transação não encontrada.')
  })
})

describe('pagarFatura', () => {
  it('marca como PAGA com pagoEm de hoje', async () => {
    await cartaoService.criarTransacao('car_a', payloadTransacao({ data: '2026-08-10' }))
    await cartaoService.criarTransacao('car_a', payloadTransacao({ data: '2026-09-10' }))
    const [ago, set] = db.faturas

    await cartaoService.pagarFatura(ago!.id)

    expect(ago!.status).toBe('PAGA')
    expect(ago!.pagoEm).toBe('2026-08-27')
    expect(set!.status).toBe('ABERTA')
    expect(set!.pagoEm).toBeNull()
  })

  it('fatura inexistente rejeita com "Fatura não encontrada."', async () => {
    await expect(cartaoService.pagarFatura('fat_x')).rejects.toThrow('Fatura não encontrada.')
  })
})
