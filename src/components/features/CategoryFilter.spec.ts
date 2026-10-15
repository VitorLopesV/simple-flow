import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CategoryFilter from '@/components/features/CategoryFilter.vue'
import type { SelectOption } from '@/types/common'

type Props = InstanceType<typeof CategoryFilter>['$props']

const CATEGORIES: SelectOption<string>[] = [
  { label: 'Despesa Fixa', value: 'c1' },
  { label: 'Despesa Variável', value: 'c2' },
  { label: 'Investimento', value: 'c3' },
]

const STATUS: SelectOption<string>[] = [
  { label: 'Pendente', value: 'PENDENTE' },
  { label: 'Pago', value: 'PAGO' },
]

/** Monta com `categoriaId` e `valorExtra` ligados como `v-model` (o valor emitido volta como prop). */
function mountComponent(props: Partial<Props> = {}) {
  const wrapper: VueWrapper = mount(CategoryFilter, {
    props: {
      categories: CATEGORIES,
      categoryId: null,
      search: '',
      'onUpdate:categoryId': (amount: string | null) => wrapper.setProps({ categoryId: amount }),
      'onUpdate:extraValue': (amount: string | null) => wrapper.setProps({ extraValue: amount }),
      ...props,
    } as Props,
  })
  return wrapper
}

const selects = (wrapper: VueWrapper) => wrapper.findAll('select')
const categorySelect = (wrapper: VueWrapper) => selects(wrapper)[0]!
const extraSelect = (wrapper: VueWrapper) => selects(wrapper)[1]!
// `type="search"` não chega ao DOM: `BaseInput` redefine `type` a partir da prop `tipo` (padrão "text").
const searchField = (wrapper: VueWrapper) => wrapper.get('input[inputmode="search"]')
const clearButton = (wrapper: VueWrapper) => wrapper.findAll('button').find((b) => b.text().includes('Limpar filtros'))

const labels = (wrapper: VueWrapper) => wrapper.findAll('label').map((label) => label.text())
const optionsOf = (select: ReturnType<typeof categorySelect>) => select.findAll('option').map((o) => o.text())
const selected = (select: ReturnType<typeof categorySelect>) =>
  (select.element as HTMLSelectElement).selectedOptions[0]?.textContent?.trim()

/** Escolhe a opção pelo texto exibido, como o usuário faria. */
async function choose(select: ReturnType<typeof categorySelect>, text: string) {
  const option = select.findAll('option').find((o) => o.text() === text)
  expect(option, `opção "${text}" não encontrada`).toBeDefined()
  ;(option!.element as HTMLOptionElement).selected = true
  await select.trigger('change')
}

describe('category', () => {
  it('lista "Todas as categorias" seguida das categorias informadas', () => {
    const wrapper = mountComponent()

    expect(optionsOf(categorySelect(wrapper))).toEqual([
      'Todas as categorias',
      'Despesa Fixa',
      'Despesa Variável',
      'Investimento',
    ])
  })

  it('sem categoria selecionada mostra "Todas as categorias"', () => {
    expect(selected(categorySelect(mountComponent()))).toBe('Todas as categorias')
  })

  it('selecionar uma categoria emite update:categoryId com o id', async () => {
    const wrapper = mountComponent()

    await choose(categorySelect(wrapper), 'Despesa Variável')

    expect(wrapper.emitted('update:categoryId')).toEqual([['c2']])
  })

  it('limpar (voltar a "Todas as categorias") emite null', async () => {
    const wrapper = mountComponent({ categoryId: 'c2' })

    await choose(categorySelect(wrapper), 'Todas as categorias')

    expect(wrapper.emitted('update:categoryId')).toEqual([[null]])
  })

  it('selecionar, limpar e selecionar de novo emite a sequência correta', async () => {
    const wrapper = mountComponent()

    await choose(categorySelect(wrapper), 'Investimento')
    await choose(categorySelect(wrapper), 'Todas as categorias')
    await choose(categorySelect(wrapper), 'Despesa Fixa')

    expect(wrapper.emitted('update:categoryId')).toEqual([['c3'], [null], ['c1']])
  })

  it('a seleção exibida acompanha o valor externo', async () => {
    const wrapper = mountComponent({ categoryId: 'c1' })
    expect(selected(categorySelect(wrapper))).toBe('Despesa Fixa')

    await wrapper.setProps({ categoryId: 'c3' })
    expect(selected(categorySelect(wrapper))).toBe('Investimento')

    await wrapper.setProps({ categoryId: null })
    expect(selected(categorySelect(wrapper))).toBe('Todas as categorias')
  })

  it('o estado exibido continua coerente após interações (v-model)', async () => {
    const wrapper = mountComponent()

    await choose(categorySelect(wrapper), 'Despesa Variável')

    expect((wrapper.props() as { categoryId: string | null }).categoryId).toBe('c2')
    expect(selected(categorySelect(wrapper))).toBe('Despesa Variável')
  })

  it('reflete uma mudança na lista de categorias', async () => {
    const wrapper = mountComponent()

    await wrapper.setProps({ categories: [{ label: 'Nova', value: 'n1' }] })

    expect(optionsOf(categorySelect(wrapper))).toEqual(['Todas as categorias', 'Nova'])
  })

  it('sem categorias renderiza só o "Todas as categorias", sem erro', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const wrapper = mountComponent({ categories: [] })

    expect(optionsOf(categorySelect(wrapper))).toEqual(['Todas as categorias'])
    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

describe('filtro extra (ex.: status)', () => {
  it('não aparece por padrão', () => {
    const wrapper = mountComponent()

    expect(selects(wrapper)).toHaveLength(1)
    expect(labels(wrapper)).toEqual(['Buscar', 'Categoria'])
  })

  it('aparece quando extraOptions é informado, com o rótulo padrão "Status" e placeholder "Todos"', () => {
    const wrapper = mountComponent({ extraOptions: STATUS })

    expect(selects(wrapper)).toHaveLength(2)
    expect(labels(wrapper)).toEqual(['Buscar', 'Categoria', 'Status'])
    expect(optionsOf(extraSelect(wrapper))).toEqual(['Todos', 'Pendente', 'Pago'])
  })

  it('usa o rótulo customizado', () => {
    const wrapper = mountComponent({ extraOptions: STATUS, extraLabel: 'Situação' })

    expect(labels(wrapper)).toContain('Situação')
    expect(labels(wrapper)).not.toContain('Status')
  })

  it('selecionar uma opção emite update:extraValue com o valor', async () => {
    const wrapper = mountComponent({ extraOptions: STATUS })

    await choose(extraSelect(wrapper), 'Pago')

    expect(wrapper.emitted('update:extraValue')).toEqual([['PAGO']])
    expect(selected(extraSelect(wrapper))).toBe('Pago')
  })

  it('voltar a "Todos" emite null', async () => {
    const wrapper = mountComponent({ extraOptions: STATUS, extraValue: 'PENDENTE' })

    await choose(extraSelect(wrapper), 'Todos')

    expect(wrapper.emitted('update:extraValue')).toEqual([[null]])
  })

  it('a seleção exibida acompanha o valor externo', async () => {
    const wrapper = mountComponent({ extraOptions: STATUS, extraValue: 'PENDENTE' })
    expect(selected(extraSelect(wrapper))).toBe('Pendente')

    await wrapper.setProps({ extraValue: 'PAGO' })
    expect(selected(extraSelect(wrapper))).toBe('Pago')

    await wrapper.setProps({ extraValue: null })
    expect(selected(extraSelect(wrapper))).toBe('Todos')
  })

  it('é independente do filtro de categoria', async () => {
    const wrapper = mountComponent({ extraOptions: STATUS })

    await choose(extraSelect(wrapper), 'Pendente')
    await choose(categorySelect(wrapper), 'Investimento')

    expect(wrapper.emitted('update:extraValue')).toEqual([['PENDENTE']])
    expect(wrapper.emitted('update:categoryId')).toEqual([['c3']])
  })

  it('extraOptions vazio ainda renderiza o seletor, sem erro', () => {
    const wrapper = mountComponent({ extraOptions: [] })

    expect(optionsOf(extraSelect(wrapper))).toEqual(['Todos'])
  })

  it('some quando extraOptions volta a ser null', async () => {
    const wrapper = mountComponent({ extraOptions: STATUS })

    await wrapper.setProps({ extraOptions: null })

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
    const wrapper = mountComponent()

    expect(labels(wrapper)[0]).toBe('Buscar')
    expect(searchField(wrapper).attributes('placeholder')).toBe('Descrição ou observação')
    expect(searchField(wrapper).attributes('inputmode')).toBe('search')
  })

  it('mostra a busca informada pelo pai', () => {
    const wrapper = mountComponent({ search: 'mercado' })

    expect((searchField(wrapper).element as HTMLInputElement).value).toBe('mercado')
  })

  it('só emite update:busca 350 ms depois de parar de digitar', async () => {
    const wrapper = mountComponent()

    await searchField(wrapper).setValue('luz')
    vi.advanceTimersByTime(349)
    expect(wrapper.emitted('update:search')).toBeUndefined()

    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('update:search')).toEqual([['luz']])
  })

  it('várias teclas seguidas geram uma única emissão, com o texto final', async () => {
    const wrapper = mountComponent()

    await searchField(wrapper).setValue('a')
    vi.advanceTimersByTime(200)
    await searchField(wrapper).setValue('al')
    vi.advanceTimersByTime(200)
    await searchField(wrapper).setValue('alu')
    vi.advanceTimersByTime(349)
    expect(wrapper.emitted('update:search')).toBeUndefined()

    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('update:search')).toEqual([['alu']])
  })

  it('apagar o texto emite string vazia', async () => {
    const wrapper = mountComponent({ search: 'luz' })

    await searchField(wrapper).setValue('')
    vi.advanceTimersByTime(350)

    expect(wrapper.emitted('update:search')).toEqual([['']])
  })

  it('atualiza o campo quando a busca muda por fora', async () => {
    const wrapper = mountComponent({ search: 'old' })

    await wrapper.setProps({ search: 'created' })

    expect((searchField(wrapper).element as HTMLInputElement).value).toBe('created')
  })
})

describe('limpar filtros', () => {
  it('o botão não aparece sem filtro ativo', () => {
    expect(clearButton(mountComponent())).toBeUndefined()
  })

  it('aparece com hasActiveFilter e emite limpar ao clicar', async () => {
    const wrapper = mountComponent({ hasActiveFilter: true })

    expect(clearButton(wrapper)).toBeDefined()
    await clearButton(wrapper)!.trigger('click')

    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.emitted('clear')![0]).toEqual([])
  })

  it('aparece e some conforme hasActiveFilter muda', async () => {
    const wrapper = mountComponent()

    await wrapper.setProps({ hasActiveFilter: true })
    expect(clearButton(wrapper)).toBeDefined()

    await wrapper.setProps({ hasActiveFilter: false })
    expect(clearButton(wrapper)).toBeUndefined()
  })
})
