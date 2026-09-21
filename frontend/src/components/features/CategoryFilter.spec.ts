import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CategoryFilter from '@/components/features/CategoryFilter.vue'
import type { OpcaoSelect } from '@/types/common'

type Props = InstanceType<typeof CategoryFilter>['$props']

const CATEGORIAS: OpcaoSelect<string>[] = [
  { label: 'Despesa Fixa', value: 'c1' },
  { label: 'Despesa Variável', value: 'c2' },
  { label: 'Investimento', value: 'c3' },
]

const STATUS: OpcaoSelect<string>[] = [
  { label: 'Pendente', value: 'PENDENTE' },
  { label: 'Pago', value: 'PAGO' },
]

/** Monta com `categoriaId` e `valorExtra` ligados como `v-model` (o valor emitido volta como prop). */
function montar(props: Partial<Props> = {}) {
  const wrapper: VueWrapper = mount(CategoryFilter, {
    props: {
      categorias: CATEGORIAS,
      categoriaId: null,
      busca: '',
      'onUpdate:categoriaId': (valor: string | null) => wrapper.setProps({ categoriaId: valor }),
      'onUpdate:valorExtra': (valor: string | null) => wrapper.setProps({ valorExtra: valor }),
      ...props,
    } as Props,
  })
  return wrapper
}

const selects = (wrapper: VueWrapper) => wrapper.findAll('select')
const seletorCategoria = (wrapper: VueWrapper) => selects(wrapper)[0]!
const seletorExtra = (wrapper: VueWrapper) => selects(wrapper)[1]!
// `type="search"` não chega ao DOM: `BaseInput` redefine `type` a partir da prop `tipo` (padrão "text").
const campoBusca = (wrapper: VueWrapper) => wrapper.get('input[inputmode="search"]')
const botaoLimpar = (wrapper: VueWrapper) => wrapper.findAll('button').find((b) => b.text().includes('Limpar filtros'))

const rotulos = (wrapper: VueWrapper) => wrapper.findAll('label').map((rotulo) => rotulo.text())
const opcoesDe = (seletor: ReturnType<typeof seletorCategoria>) => seletor.findAll('option').map((o) => o.text())
const selecionada = (seletor: ReturnType<typeof seletorCategoria>) =>
  (seletor.element as HTMLSelectElement).selectedOptions[0]?.textContent?.trim()

/** Escolhe a opção pelo texto exibido, como o usuário faria. */
async function escolher(seletor: ReturnType<typeof seletorCategoria>, texto: string) {
  const opcao = seletor.findAll('option').find((o) => o.text() === texto)
  expect(opcao, `opção "${texto}" não encontrada`).toBeDefined()
  ;(opcao!.element as HTMLOptionElement).selected = true
  await seletor.trigger('change')
}

describe('categoria', () => {
  it('lista "Todas as categorias" seguida das categorias informadas', () => {
    const wrapper = montar()

    expect(opcoesDe(seletorCategoria(wrapper))).toEqual([
      'Todas as categorias',
      'Despesa Fixa',
      'Despesa Variável',
      'Investimento',
    ])
  })

  it('sem categoria selecionada mostra "Todas as categorias"', () => {
    expect(selecionada(seletorCategoria(montar()))).toBe('Todas as categorias')
  })

  it('selecionar uma categoria emite update:categoriaId com o id', async () => {
    const wrapper = montar()

    await escolher(seletorCategoria(wrapper), 'Despesa Variável')

    expect(wrapper.emitted('update:categoriaId')).toEqual([['c2']])
  })

  it('limpar (voltar a "Todas as categorias") emite null', async () => {
    const wrapper = montar({ categoriaId: 'c2' })

    await escolher(seletorCategoria(wrapper), 'Todas as categorias')

    expect(wrapper.emitted('update:categoriaId')).toEqual([[null]])
  })

  it('selecionar, limpar e selecionar de novo emite a sequência correta', async () => {
    const wrapper = montar()

    await escolher(seletorCategoria(wrapper), 'Investimento')
    await escolher(seletorCategoria(wrapper), 'Todas as categorias')
    await escolher(seletorCategoria(wrapper), 'Despesa Fixa')

    expect(wrapper.emitted('update:categoriaId')).toEqual([['c3'], [null], ['c1']])
  })

  it('a seleção exibida acompanha o valor externo', async () => {
    const wrapper = montar({ categoriaId: 'c1' })
    expect(selecionada(seletorCategoria(wrapper))).toBe('Despesa Fixa')

    await wrapper.setProps({ categoriaId: 'c3' })
    expect(selecionada(seletorCategoria(wrapper))).toBe('Investimento')

    await wrapper.setProps({ categoriaId: null })
    expect(selecionada(seletorCategoria(wrapper))).toBe('Todas as categorias')
  })

  it('o estado exibido continua coerente após interações (v-model)', async () => {
    const wrapper = montar()

    await escolher(seletorCategoria(wrapper), 'Despesa Variável')

    expect((wrapper.props() as { categoriaId: string | null }).categoriaId).toBe('c2')
    expect(selecionada(seletorCategoria(wrapper))).toBe('Despesa Variável')
  })

  it('reflete uma mudança na lista de categorias', async () => {
    const wrapper = montar()

    await wrapper.setProps({ categorias: [{ label: 'Nova', value: 'n1' }] })

    expect(opcoesDe(seletorCategoria(wrapper))).toEqual(['Todas as categorias', 'Nova'])
  })

  it('sem categorias renderiza só o "Todas as categorias", sem erro', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const wrapper = montar({ categorias: [] })

    expect(opcoesDe(seletorCategoria(wrapper))).toEqual(['Todas as categorias'])
    expect(erro).not.toHaveBeenCalled()
    expect(aviso).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

describe('filtro extra (ex.: status)', () => {
  it('não aparece por padrão', () => {
    const wrapper = montar()

    expect(selects(wrapper)).toHaveLength(1)
    expect(rotulos(wrapper)).toEqual(['Buscar', 'Categoria'])
  })

  it('aparece quando opcoesExtra é informado, com o rótulo padrão "Status" e placeholder "Todos"', () => {
    const wrapper = montar({ opcoesExtra: STATUS })

    expect(selects(wrapper)).toHaveLength(2)
    expect(rotulos(wrapper)).toEqual(['Buscar', 'Categoria', 'Status'])
    expect(opcoesDe(seletorExtra(wrapper))).toEqual(['Todos', 'Pendente', 'Pago'])
  })

  it('usa o rótulo customizado', () => {
    const wrapper = montar({ opcoesExtra: STATUS, rotuloExtra: 'Situação' })

    expect(rotulos(wrapper)).toContain('Situação')
    expect(rotulos(wrapper)).not.toContain('Status')
  })

  it('selecionar uma opção emite update:valorExtra com o valor', async () => {
    const wrapper = montar({ opcoesExtra: STATUS })

    await escolher(seletorExtra(wrapper), 'Pago')

    expect(wrapper.emitted('update:valorExtra')).toEqual([['PAGO']])
    expect(selecionada(seletorExtra(wrapper))).toBe('Pago')
  })

  it('voltar a "Todos" emite null', async () => {
    const wrapper = montar({ opcoesExtra: STATUS, valorExtra: 'PENDENTE' })

    await escolher(seletorExtra(wrapper), 'Todos')

    expect(wrapper.emitted('update:valorExtra')).toEqual([[null]])
  })

  it('a seleção exibida acompanha o valor externo', async () => {
    const wrapper = montar({ opcoesExtra: STATUS, valorExtra: 'PENDENTE' })
    expect(selecionada(seletorExtra(wrapper))).toBe('Pendente')

    await wrapper.setProps({ valorExtra: 'PAGO' })
    expect(selecionada(seletorExtra(wrapper))).toBe('Pago')

    await wrapper.setProps({ valorExtra: null })
    expect(selecionada(seletorExtra(wrapper))).toBe('Todos')
  })

  it('é independente do filtro de categoria', async () => {
    const wrapper = montar({ opcoesExtra: STATUS })

    await escolher(seletorExtra(wrapper), 'Pendente')
    await escolher(seletorCategoria(wrapper), 'Investimento')

    expect(wrapper.emitted('update:valorExtra')).toEqual([['PENDENTE']])
    expect(wrapper.emitted('update:categoriaId')).toEqual([['c3']])
  })

  it('opcoesExtra vazio ainda renderiza o seletor, sem erro', () => {
    const wrapper = montar({ opcoesExtra: [] })

    expect(opcoesDe(seletorExtra(wrapper))).toEqual(['Todos'])
  })

  it('some quando opcoesExtra volta a ser null', async () => {
    const wrapper = montar({ opcoesExtra: STATUS })

    await wrapper.setProps({ opcoesExtra: null })

    expect(selects(wrapper)).toHaveLength(1)
  })
})

describe('busca com debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('campo de busca com rótulo, placeholder e teclado de busca', () => {
    const wrapper = montar()

    expect(rotulos(wrapper)[0]).toBe('Buscar')
    expect(campoBusca(wrapper).attributes('placeholder')).toBe('Descrição ou observação')
    expect(campoBusca(wrapper).attributes('inputmode')).toBe('search')
  })

  it('mostra a busca informada pelo pai', () => {
    const wrapper = montar({ busca: 'mercado' })

    expect((campoBusca(wrapper).element as HTMLInputElement).value).toBe('mercado')
  })

  it('só emite update:busca 350 ms depois de parar de digitar', async () => {
    const wrapper = montar()

    await campoBusca(wrapper).setValue('luz')
    vi.advanceTimersByTime(349)
    expect(wrapper.emitted('update:busca')).toBeUndefined()

    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('update:busca')).toEqual([['luz']])
  })

  it('várias teclas seguidas geram uma única emissão, com o texto final', async () => {
    const wrapper = montar()

    await campoBusca(wrapper).setValue('a')
    vi.advanceTimersByTime(200)
    await campoBusca(wrapper).setValue('al')
    vi.advanceTimersByTime(200)
    await campoBusca(wrapper).setValue('alu')
    vi.advanceTimersByTime(349)
    expect(wrapper.emitted('update:busca')).toBeUndefined()

    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('update:busca')).toEqual([['alu']])
  })

  it('apagar o texto emite string vazia', async () => {
    const wrapper = montar({ busca: 'luz' })

    await campoBusca(wrapper).setValue('')
    vi.advanceTimersByTime(350)

    expect(wrapper.emitted('update:busca')).toEqual([['']])
  })

  it('atualiza o campo quando a busca muda por fora', async () => {
    const wrapper = montar({ busca: 'antiga' })

    await wrapper.setProps({ busca: 'nova' })

    expect((campoBusca(wrapper).element as HTMLInputElement).value).toBe('nova')
  })
})

describe('limpar filtros', () => {
  it('o botão não aparece sem filtro ativo', () => {
    expect(botaoLimpar(montar())).toBeUndefined()
  })

  it('aparece com temFiltroAtivo e emite limpar ao clicar', async () => {
    const wrapper = montar({ temFiltroAtivo: true })

    expect(botaoLimpar(wrapper)).toBeDefined()
    await botaoLimpar(wrapper)!.trigger('click')

    expect(wrapper.emitted('limpar')).toHaveLength(1)
    expect(wrapper.emitted('limpar')![0]).toEqual([])
  })

  it('aparece e some conforme temFiltroAtivo muda', async () => {
    const wrapper = montar()

    await wrapper.setProps({ temFiltroAtivo: true })
    expect(botaoLimpar(wrapper)).toBeDefined()

    await wrapper.setProps({ temFiltroAtivo: false })
    expect(botaoLimpar(wrapper)).toBeUndefined()
  })
})
