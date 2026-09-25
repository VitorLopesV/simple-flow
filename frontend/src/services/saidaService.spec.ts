import { beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { USE_MOCK } from '@/services/http'
import { mockDb } from '@/services/mock'
import { compararSaidasPorVencimento, saidaService } from '@/services/saidaService'
import type { Saida, SaidaFiltro, SaidaPayload } from '@/types/saida'

type Db = Awaited<ReturnType<typeof mockDb>>

let db: Db
let categoriaA: string
let categoriaB: string

let sequencia = 0

function saida(sobrescritas: Partial<Saida> = {}): Saida {
  sequencia += 1
  return {
    id: `sai_teste_${sequencia}`,
    descricao: 'Conta',
    valor: 100,
    data: '2026-08-10',
    categoriaId: categoriaA,
    tipo: 'CONTA',
    status: 'PENDENTE',
    vencimento: null,
    pagoEm: null,
    formaPagamento: 'PIX',
    cartaoId: null,
    recorrente: false,
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

function payload(sobrescritas: Partial<SaidaPayload> = {}): SaidaPayload {
  return {
    descricao: 'Conta',
    valor: 100,
    data: '2026-08-10',
    categoriaId: categoriaA,
    tipo: 'CONTA',
    status: 'PENDENTE',
    vencimento: null,
    pagoEm: null,
    formaPagamento: 'PIX',
    cartaoId: null,
    recorrente: false,
    ...sobrescritas,
  }
}

function filtro(sobrescritas: Partial<SaidaFiltro> = {}): SaidaFiltro {
  return { periodo: { mes: 8, ano: 2026 }, page: 1, pageSize: 50, ...sobrescritas }
}

beforeEach(async () => {
  db = await mockDb()
  db.saidas.length = 0
  db.faturas.length = 0
  db.transacoesCartao.length = 0
  categoriaA = db.categorias[0]!.id
  categoriaB = db.categorias[1]!.id
})

it('roda no modo mock, sem chamadas de rede', () => {
  expect(USE_MOCK).toBe(true)
})

describe('compararSaidasPorVencimento', () => {
  it('com ambas com vencimento, o mais próximo vem primeiro', () => {
    const cedo = saida({ vencimento: '2026-08-05' })
    const tarde = saida({ vencimento: '2026-08-10' })

    expect(compararSaidasPorVencimento(cedo, tarde)).toBeLessThan(0)
    expect(compararSaidasPorVencimento(tarde, cedo)).toBeGreaterThan(0)
    expect(compararSaidasPorVencimento(cedo, { ...cedo })).toBe(0)
  })

  it('com só uma com vencimento, ela vem primeiro', () => {
    const com = saida({ vencimento: '2026-08-30' })
    const sem = saida({ vencimento: null, data: '2026-08-01' })

    expect(compararSaidasPorVencimento(com, sem)).toBe(-1)
    expect(compararSaidasPorVencimento(sem, com)).toBe(1)
  })

  it('sem vencimento em nenhuma, a data mais recente vem primeiro', () => {
    const antiga = saida({ data: '2026-08-01' })
    const recente = saida({ data: '2026-08-20' })

    expect(compararSaidasPorVencimento(antiga, recente)).toBeGreaterThan(0)
    expect(compararSaidasPorVencimento(recente, antiga)).toBeLessThan(0)
  })

  it('ordena uma lista mista com todas as regras', () => {
    const semAntiga = saida({ id: 'sem_antiga', data: '2026-08-01' })
    const semRecente = saida({ id: 'sem_recente', data: '2026-08-20' })
    const venceTarde = saida({ id: 'tarde', vencimento: '2026-08-25' })
    const venceCedo = saida({ id: 'cedo', vencimento: '2026-08-03' })

    const ordenadas = [semAntiga, venceTarde, semRecente, venceCedo].sort(compararSaidasPorVencimento)

    expect(ordenadas.map((s) => s.id)).toEqual(['cedo', 'tarde', 'sem_recente', 'sem_antiga'])
  })
})

describe('listar', () => {
  it('filtra pelo período', async () => {
    db.saidas.push(
      saida({ id: 'ago', data: '2026-08-10' }),
      saida({ id: 'set', data: '2026-09-10' }),
      saida({ id: 'jul', data: '2026-07-31' }),
    )

    const { items } = await saidaService.listar(filtro())

    expect(items.map((s) => s.id)).toEqual(['ago'])
  })

  it('filtra por categoria', async () => {
    db.saidas.push(
      saida({ id: 'a', categoriaId: categoriaA }),
      saida({ id: 'b', categoriaId: categoriaB }),
    )

    const { items } = await saidaService.listar(filtro({ categoriaId: categoriaB }))

    expect(items.map((s) => s.id)).toEqual(['b'])
  })

  it('filtra por status', async () => {
    db.saidas.push(
      saida({ id: 'pendente', status: 'PENDENTE' }),
      saida({ id: 'pago', status: 'PAGO', pagoEm: '2026-08-10' }),
    )

    const pagas = await saidaService.listar(filtro({ status: 'PAGO' }))
    const pendentes = await saidaService.listar(filtro({ status: 'PENDENTE' }))

    expect(pagas.items.map((s) => s.id)).toEqual(['pago'])
    expect(pendentes.items.map((s) => s.id)).toEqual(['pendente'])
  })

  it('busca sem diferenciar acento nem caixa, considerando a observação', async () => {
    db.saidas.push(
      saida({ id: 'cafe', descricao: 'Café da manhã' }),
      saida({ id: 'obs', descricao: 'Compra', observacao: 'No MERCADO central' }),
      saida({ id: 'outra', descricao: 'Aluguel' }),
    )

    const porDescricao = await saidaService.listar(filtro({ busca: 'CAFE' }))
    const porObservacao = await saidaService.listar(filtro({ busca: 'mercado' }))

    expect(porDescricao.items.map((s) => s.id)).toEqual(['cafe'])
    expect(porObservacao.items.map((s) => s.id)).toEqual(['obs'])
  })

  it('inclui projeções de recorrência do período', async () => {
    db.saidas.push(saida({ id: 'origem', descricao: 'Aluguel', data: '2026-07-05', recorrente: true }))

    const { items } = await saidaService.listar(filtro())

    expect(items.map((s) => s.id)).toEqual(['origem_2026-08'])
    expect(items[0]).toMatchObject({ data: '2026-08-05', origemRecorrenciaId: 'origem', status: 'PENDENTE' })
  })

  it('inclui a fatura de cartão do período como saída automática', async () => {
    const cartao = db.cartoes[0]!
    const fatura = db.garantirFatura(cartao.id, '2026-08')
    fatura.total = 450

    const { items } = await saidaService.listar(filtro())

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: `sai_fat_${fatura.id}`,
      valor: 450,
      automatica: true,
      formaPagamento: 'CARTAO_CREDITO',
    })
  })

  it('pagina e informa total e totalPages', async () => {
    for (let dia = 1; dia <= 5; dia += 1) {
      db.saidas.push(saida({ id: `s${dia}`, data: `2026-08-0${dia}` }))
    }

    const primeira = await saidaService.listar(filtro({ page: 1, pageSize: 2 }))
    const ultima = await saidaService.listar(filtro({ page: 3, pageSize: 2 }))

    expect(primeira.items).toHaveLength(2)
    expect(primeira.total).toBe(5)
    expect(primeira.totalPages).toBe(3)
    expect(ultima.items).toHaveLength(1)
    expect(ultima.page).toBe(3)
  })

  it('ordena por vencimento antes das sem vencimento', async () => {
    db.saidas.push(
      saida({ id: 'sem', data: '2026-08-28' }),
      saida({ id: 'tarde', vencimento: '2026-08-25' }),
      saida({ id: 'cedo', vencimento: '2026-08-03' }),
    )

    const { items } = await saidaService.listar(filtro())

    expect(items.map((s) => s.id)).toEqual(['cedo', 'tarde', 'sem'])
  })

  it('devolve cópias: alterar o resultado não muda o banco', async () => {
    db.saidas.push(saida({ id: 'a', descricao: 'Original' }))

    const { items } = await saidaService.listar(filtro())
    items[0]!.descricao = 'Alterada'

    expect(db.saidas[0]!.descricao).toBe('Original')
  })
})

describe('resumo', () => {
  it('calcula totais, média, pago/pendente e mês anterior', async () => {
    db.saidas.push(
      saida({ valor: 100, status: 'PAGO', pagoEm: '2026-08-02', categoriaId: categoriaA }),
      saida({ valor: 50, status: 'PENDENTE', categoriaId: categoriaA }),
      saida({ valor: 250, status: 'PAGO', pagoEm: '2026-08-03', categoriaId: categoriaB }),
      saida({ valor: 70, data: '2026-07-15', categoriaId: categoriaA }),
      saida({ valor: 999, data: '2026-09-15', categoriaId: categoriaA }),
    )

    const resumo = await saidaService.resumo({ mes: 8, ano: 2026 })

    expect(resumo.total).toBe(400)
    expect(resumo.quantidade).toBe(3)
    expect(resumo.media).toBeCloseTo(400 / 3)
    expect(resumo.totalPago).toBe(350)
    expect(resumo.totalPendente).toBe(50)
    expect(resumo.totalMesAnterior).toBe(70)
  })

  it('ordena porCategoria do maior para o menor, com nome e cor da categoria', async () => {
    db.saidas.push(
      saida({ valor: 100, categoriaId: categoriaA }),
      saida({ valor: 50, categoriaId: categoriaA }),
      saida({ valor: 250, categoriaId: categoriaB }),
    )

    const { porCategoria } = await saidaService.resumo({ mes: 8, ano: 2026 })

    const catA = db.categorias.find((c) => c.id === categoriaA)!
    const catB = db.categorias.find((c) => c.id === categoriaB)!
    expect(porCategoria).toEqual([
      { categoriaId: categoriaB, nome: catB.nome, cor: catB.cor, total: 250 },
      { categoriaId: categoriaA, nome: catA.nome, cor: catA.cor, total: 150 },
    ])
  })

  it('usa "Sem categoria" e cor neutra para categoria desconhecida', async () => {
    db.saidas.push(saida({ valor: 40, categoriaId: 'cat_inexistente' }))

    const { porCategoria } = await saidaService.resumo({ mes: 8, ano: 2026 })

    expect(porCategoria).toEqual([
      { categoriaId: 'cat_inexistente', nome: 'Sem categoria', cor: '#94a3b8', total: 40 },
    ])
  })

  it('agrupa por tipo, ordena por total e ignora outros meses', async () => {
    db.saidas.push(
      saida({ valor: 30, tipo: 'LAZER' }),
      saida({ valor: 20, tipo: 'LAZER' }),
      saida({ valor: 90, tipo: 'TRANSPORTE' }),
      saida({ valor: 500, tipo: 'CONTA', data: '2026-07-10' }),
    )

    const resumo = await saidaService.resumo({ mes: 8, ano: 2026 })

    expect(resumo.porTipo).toEqual([
      { tipo: 'TRANSPORTE', total: 90 },
      { tipo: 'LAZER', total: 50 },
    ])
  })

  it('devolve zeros e média 0 sem itens', async () => {
    const resumo = await saidaService.resumo({ mes: 8, ano: 2026 })

    expect(resumo).toEqual({
      total: 0,
      quantidade: 0,
      media: 0,
      totalPago: 0,
      totalPendente: 0,
      totalMesAnterior: 0,
      porCategoria: [],
      porTipo: [],
    })
  })
})

describe('criar', () => {
  it('PAGO define pagoEm como hoje, ignorando o valor do payload', async () => {
    const criada = await saidaService.criar(payload({ status: 'PAGO', pagoEm: '1999-01-01' }))

    expect(criada.pagoEm).toBe(db.hojeISO)
  })

  it('PENDENTE define pagoEm como null, ignorando o valor do payload', async () => {
    const criada = await saidaService.criar(payload({ status: 'PENDENTE', pagoEm: '1999-01-01' }))

    expect(criada.pagoEm).toBeNull()
  })

  it('gera id e datas de auditoria e persiste no banco', async () => {
    const criada = await saidaService.criar(payload({ descricao: 'Nova' }))

    expect(criada.id).toMatch(/^sai_\d+$/)
    expect(Number.isNaN(Date.parse(criada.criadoEm))).toBe(false)
    expect(Number.isNaN(Date.parse(criada.atualizadoEm))).toBe(false)
    expect(criada.descricao).toBe('Nova')
    expect(db.saidas).toHaveLength(1)
    expect(db.saidas[0]).toEqual(criada)
    expect(db.saidas[0]).not.toBe(criada)
  })
})

describe('atualizar', () => {
  it('pendente → paga carimba hoje', async () => {
    db.saidas.push(saida({ id: 'x', status: 'PENDENTE' }))

    const atualizada = await saidaService.atualizar('x', payload({ status: 'PAGO' }))

    expect(atualizada.pagoEm).toBe(db.hojeISO)
  })

  it('já paga mantém a data de pagamento original', async () => {
    db.saidas.push(saida({ id: 'x', status: 'PAGO', pagoEm: '2026-08-01' }))

    const atualizada = await saidaService.atualizar('x', payload({ status: 'PAGO', pagoEm: '2030-01-01' }))

    expect(atualizada.pagoEm).toBe('2026-08-01')
  })

  it('paga → pendente limpa pagoEm', async () => {
    db.saidas.push(saida({ id: 'x', status: 'PAGO', pagoEm: '2026-08-01' }))

    const atualizada = await saidaService.atualizar('x', payload({ status: 'PENDENTE' }))

    expect(atualizada.pagoEm).toBeNull()
  })

  it('atualiza o registro no banco preservando id e criadoEm', async () => {
    db.saidas.push(saida({ id: 'x', valor: 10 }))

    const atualizada = await saidaService.atualizar('x', payload({ valor: 99 }))

    expect(atualizada.id).toBe('x')
    expect(atualizada.valor).toBe(99)
    expect(atualizada.criadoEm).toBe('2026-01-01T00:00:00.000Z')
    expect(atualizada.atualizadoEm).not.toBe('2026-01-01T00:00:00.000Z')
    expect(db.saidas).toHaveLength(1)
    expect(db.saidas[0]!.valor).toBe(99)
  })

  it('saída recorrente mantém a descrição original enquanto continuar recorrente', async () => {
    db.saidas.push(saida({ id: 'x', descricao: 'Aluguel', recorrente: true }))

    const atualizada = await saidaService.atualizar(
      'x',
      payload({ descricao: 'Outro nome', recorrente: true }),
    )

    expect(atualizada.descricao).toBe('Aluguel')
  })

  it('ao deixar de ser recorrente, aceita a nova descrição', async () => {
    db.saidas.push(saida({ id: 'x', descricao: 'Aluguel', recorrente: true }))

    const atualizada = await saidaService.atualizar(
      'x',
      payload({ descricao: 'Outro nome', recorrente: false }),
    )

    expect(atualizada.descricao).toBe('Outro nome')
  })

  it('editar ocorrência projetada materializa uma linha nova com a descrição da origem', async () => {
    const origem = saida({ id: 'origem', descricao: 'Aluguel', data: '2026-07-05', recorrente: true })
    db.saidas.push(origem)

    const criada = await saidaService.atualizar(
      'origem_2026-08',
      payload({ descricao: 'Nome diferente', data: '2026-08-05', status: 'PAGO', recorrente: true }),
    )

    expect(criada.id).not.toBe('origem_2026-08')
    expect(criada.id).toMatch(/^sai_\d+$/)
    expect(criada.descricao).toBe('Aluguel')
    expect(criada.pagoEm).toBe(db.hojeISO)
    expect(db.saidas).toHaveLength(2)
    expect(db.saidas[0]).toEqual(origem)
  })

  it('id inexistente rejeita com "Saída não encontrada."', async () => {
    await expect(saidaService.atualizar('sai_nao_existe', payload())).rejects.toThrow(
      'Saída não encontrada.',
    )
  })

  it('id projetado cuja origem não existe ou não é recorrente rejeita', async () => {
    db.saidas.push(saida({ id: 'fixa', recorrente: false }))

    await expect(saidaService.atualizar('fantasma_2026-08', payload())).rejects.toThrow(
      'Saída não encontrada.',
    )
    await expect(saidaService.atualizar('fixa_2026-08', payload())).rejects.toThrow(
      'Saída não encontrada.',
    )
    expect(db.saidas).toHaveLength(1)
  })
})

describe('remover', () => {
  it('remove a saída e ela deixa de ser listada', async () => {
    db.saidas.push(saida({ id: 'a' }), saida({ id: 'b' }))

    await saidaService.remover('a')
    const { items } = await saidaService.listar(filtro())

    expect(items.map((s) => s.id)).toEqual(['b'])
    expect(db.saidas).toHaveLength(1)
  })

  it('id inexistente rejeita com "Saída não encontrada."', async () => {
    await expect(saidaService.remover('sai_nao_existe')).rejects.toThrow('Saída não encontrada.')
  })
})
