import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockDb } from '@/services/mock'
import { categoriaService } from '@/services/categoriaService'
import type { Categoria, CategoriaTipo } from '@/types/categoria'

const http = vi.hoisted(() => ({ useMock: true, get: vi.fn() }))

vi.mock('@/services/http', () => ({
  get USE_MOCK() {
    return http.useMock
  },
  MOCK_LATENCY: 0,
  http: { get: http.get },
}))

let sequencia = 0

function categoria(nome: string, tipo: CategoriaTipo = 'CONTA_FIXA'): Categoria {
  sequencia += 1
  return { id: `cat_${sequencia}`, nome, tipo, movimento: 'SAIDA', cor: '#000000' }
}

const nomes = (lista: Categoria[]) => lista.map((c) => c.nome)

/** Modo API real: o backend entrega `dados` e o service reordena no cliente. */
async function listarDaApi(dados: Categoria[]): Promise<Categoria[]> {
  http.useMock = false
  http.get.mockResolvedValue({ data: dados })
  return categoriaService.listar()
}

beforeEach(() => {
  http.useMock = true
  http.get.mockReset()
})

describe('listar (API real)', () => {
  it('chama GET /categorias', async () => {
    await listarDaApi([])

    expect(http.get).toHaveBeenCalledWith('/categorias')
  })

  it('ordena alfabeticamente respeitando acentos em pt-BR', async () => {
    const resultado = await listarDaApi([
      categoria('Casa'),
      categoria('Benefício'),
      categoria('Água'),
    ])

    expect(nomes(resultado)).toEqual(['Água', 'Benefício', 'Casa'])
  })

  it('manda para o fim a categoria com tipo OUTROS, mesmo com nome começando em A', async () => {
    const resultado = await listarDaApi([
      categoria('Almoço extra', 'OUTROS'),
      categoria('Zebra'),
      categoria('Bolsa'),
    ])

    expect(nomes(resultado)).toEqual(['Bolsa', 'Zebra', 'Almoço extra'])
  })

  it('manda para o fim a categoria cujo nome casa /^outr/i', async () => {
    const resultado = await listarDaApi([
      categoria('Outras receitas', 'RENDA'),
      categoria('outros gastos', 'CONTA_VARIAVEL'),
      categoria('Salário', 'RENDA'),
      categoria('Zebra'),
    ])

    expect(nomes(resultado)).toEqual(['Salário', 'Zebra', 'Outras receitas', 'outros gastos'])
  })

  it('mantém ordem alfabética entre as catch-all', async () => {
    const resultado = await listarDaApi([
      categoria('Outros', 'OUTROS'),
      categoria('Aaa catch-all', 'OUTROS'),
      categoria('Outras receitas', 'RENDA'),
      categoria('Casa'),
    ])

    expect(nomes(resultado)).toEqual(['Casa', 'Aaa catch-all', 'Outras receitas', 'Outros'])
  })

  it('não depende da ordem em que a API entrega os dados', async () => {
    const dados = [
      categoria('Água'),
      categoria('Benefício', 'RENDA'),
      categoria('Casa'),
      categoria('Outras receitas', 'RENDA'),
      categoria('Outros', 'OUTROS'),
    ]
    const esperado = ['Água', 'Benefício', 'Casa', 'Outras receitas', 'Outros']

    expect(nomes(await listarDaApi([...dados]))).toEqual(esperado)
    expect(nomes(await listarDaApi([...dados].reverse()))).toEqual(esperado)
    expect(nomes(await listarDaApi([dados[3]!, dados[0]!, dados[4]!, dados[2]!, dados[1]!]))).toEqual(
      esperado,
    )
  })

  it('não muta o array devolvido pela API', async () => {
    const dados = [categoria('Zebra'), categoria('Água'), categoria('Outros', 'OUTROS')]
    const ordemOriginal = [...dados]

    const resultado = await listarDaApi(dados)

    expect(resultado).not.toBe(dados)
    expect(dados).toEqual(ordemOriginal)
    expect(nomes(resultado)).toEqual(['Água', 'Zebra', 'Outros'])
  })
})

describe('listar (mock)', () => {
  it('não chama a API', async () => {
    await categoriaService.listar()

    expect(http.get).not.toHaveBeenCalled()
  })

  it('devolve as categorias do banco com o catch-all por último e sem NaN de ordenação', async () => {
    const db = await mockDb()

    const resultado = await categoriaService.listar()

    expect(resultado).toHaveLength(db.categorias.length)
    const catchAll = (c: Categoria) => c.tipo === 'OUTROS' || /^outr/i.test(c.nome)
    const primeiroCatchAll = resultado.findIndex(catchAll)
    expect(primeiroCatchAll).toBeGreaterThan(-1)
    expect(resultado.slice(primeiroCatchAll).every(catchAll)).toBe(true)
    expect(resultado.slice(0, primeiroCatchAll).some(catchAll)).toBe(false)

    const normais = resultado.slice(0, primeiroCatchAll).map((c) => c.nome)
    expect(normais).toEqual([...normais].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })

  it('não expõe o array do banco nem seus objetos por referência', async () => {
    const db = await mockDb()
    const ordemDoBanco = db.categorias.map((c) => c.id)
    const nomeOriginal = db.categorias[0]!.nome

    const resultado = await categoriaService.listar()
    resultado[0]!.nome = 'Alterada no consumidor'
    resultado.length = 0

    expect(db.categorias.map((c) => c.id)).toEqual(ordemDoBanco)
    expect(db.categorias[0]!.nome).toBe(nomeOriginal)
  })

  it('não reordena o array do banco', async () => {
    const db = await mockDb()
    const antes = db.categorias.map((c) => c.id)

    await categoriaService.listar()

    expect(db.categorias.map((c) => c.id)).toEqual(antes)
  })
})
