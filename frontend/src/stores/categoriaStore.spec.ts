import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { categoriaService } from '@/services/categoriaService'
import { useCategoriaStore } from '@/stores/categoriaStore'
import type { Categoria } from '@/types/categoria'

vi.mock('@/services/categoriaService', () => ({
  categoriaService: { listar: vi.fn() },
}))

const listar = vi.mocked(categoriaService.listar)

const CATEGORIAS: Categoria[] = [
  { id: 'c1', nome: 'Despesa Fixa', tipo: 'CONTA_FIXA', movimento: 'SAIDA', cor: '#6366f1' },
  { id: 'c2', nome: 'Investimento', tipo: 'INVESTIMENTO', movimento: 'SAIDA', cor: '#0891b2' },
  { id: 'c3', nome: 'Salário', tipo: 'RENDA', movimento: 'ENTRADA', cor: '#10b981' },
  { id: 'c4', nome: 'Rendimentos', tipo: 'INVESTIMENTO', movimento: 'ENTRADA', cor: '#eab308' },
  { id: 'c5', nome: 'Outras receitas', tipo: 'OUTROS', movimento: 'ENTRADA', cor: '#94a3b8' },
]

function storeCarregado() {
  const store = useCategoriaStore()
  return store.carregar().then(() => store)
}

beforeEach(() => {
  setActivePinia(createPinia())
  listar.mockReset()
  listar.mockResolvedValue(CATEGORIAS)
})

describe('estado inicial', () => {
  it('começa vazio e sem carregar', () => {
    const store = useCategoriaStore()

    expect(store.categorias).toEqual([])
    expect(store.carregado).toBe(false)
    expect(store.loading).toBe(false)
    expect(store.erro).toBeNull()
  })
})

describe('carregar', () => {
  it('popula as categorias, marca carregado e desliga o loading', async () => {
    const store = useCategoriaStore()

    await store.carregar()

    expect(store.categorias).toEqual(CATEGORIAS)
    expect(store.carregado).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.erro).toBeNull()
  })

  it('mantém loading verdadeiro enquanto a chamada está em andamento', async () => {
    let concluir!: (lista: Categoria[]) => void
    listar.mockReturnValue(new Promise<Categoria[]>((resolve) => (concluir = resolve)))
    const store = useCategoriaStore()

    const promessa = store.carregar()
    expect(store.loading).toBe(true)

    concluir(CATEGORIAS)
    await promessa

    expect(store.loading).toBe(false)
  })

  it('a segunda chamada não chama o service', async () => {
    const store = await storeCarregado()

    await store.carregar()

    expect(listar).toHaveBeenCalledTimes(1)
  })

  it('carregar(true) chama o service de novo e atualiza a lista', async () => {
    const store = await storeCarregado()
    listar.mockResolvedValue([CATEGORIAS[0]!])

    await store.carregar(true)

    expect(listar).toHaveBeenCalledTimes(2)
    expect(store.categorias).toEqual([CATEGORIAS[0]])
  })

  it('falha: guarda a mensagem do erro, não marca carregado e desliga o loading', async () => {
    listar.mockRejectedValue(new Error('Servidor fora do ar'))
    const store = useCategoriaStore()

    await store.carregar()

    expect(store.erro).toBe('Servidor fora do ar')
    expect(store.carregado).toBe(false)
    expect(store.loading).toBe(false)
    expect(store.categorias).toEqual([])
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    listar.mockRejectedValue('quebrou')
    const store = useCategoriaStore()

    await store.carregar()

    expect(store.erro).toBe('Não foi possível carregar as categorias.')
  })

  it('após uma falha, tentar de novo chama o service e limpa o erro', async () => {
    listar.mockRejectedValueOnce(new Error('falhou'))
    const store = useCategoriaStore()
    await store.carregar()
    expect(store.erro).toBe('falhou')

    await store.carregar()

    expect(listar).toHaveBeenCalledTimes(2)
    expect(store.erro).toBeNull()
    expect(store.carregado).toBe(true)
    expect(store.categorias).toEqual(CATEGORIAS)
  })
})

describe('deEntrada / deSaida', () => {
  it('filtram por movimento', async () => {
    const store = await storeCarregado()

    expect(store.deEntrada.map((c) => c.id)).toEqual(['c3', 'c4', 'c5'])
    expect(store.deSaida.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('ficam vazias antes de carregar', () => {
    const store = useCategoriaStore()

    expect(store.deEntrada).toEqual([])
    expect(store.deSaida).toEqual([])
  })
})

describe('opcoes', () => {
  it('SAIDA usa só o nome, sem sufixo de tipo', async () => {
    const store = await storeCarregado()

    expect(store.opcoes('SAIDA')).toEqual([
      { label: 'Despesa Fixa', value: 'c1' },
      { label: 'Investimento', value: 'c2' },
    ])
  })

  it('ENTRADA com tipo RENDA usa só o nome; os demais levam o tipo como sufixo', async () => {
    const store = await storeCarregado()

    expect(store.opcoes('ENTRADA')).toEqual([
      { label: 'Salário', value: 'c3' },
      { label: 'Rendimentos · Investimentos', value: 'c4' },
      { label: 'Outras receitas · Outros', value: 'c5' },
    ])
  })
})

describe('nome / cor / tipo', () => {
  it('devolvem os dados da categoria existente', async () => {
    const store = await storeCarregado()

    expect(store.nome('c3')).toBe('Salário')
    expect(store.cor('c3')).toBe('#10b981')
    expect(store.tipo('c3')).toBe('RENDA')
  })

  it.each([null, undefined, '', 'inexistente'])('usam o fallback para id %j', async (id) => {
    const store = await storeCarregado()

    expect(store.nome(id)).toBe('Sem categoria')
    expect(store.cor(id)).toBe('#94a3b8')
    expect(store.tipo(id)).toBeNull()
  })

  it('usam o fallback antes de carregar', () => {
    const store = useCategoriaStore()

    expect(store.nome('c1')).toBe('Sem categoria')
    expect(store.cor('c1')).toBe('#94a3b8')
    expect(store.tipo('c1')).toBeNull()
  })

  it('porId indexa todas as categorias', async () => {
    const store = await storeCarregado()

    expect(store.porId.size).toBe(CATEGORIAS.length)
    expect(store.porId.get('c2')?.nome).toBe('Investimento')
  })
})
