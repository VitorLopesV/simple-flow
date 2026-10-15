import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BasePagination from '@/components/common/BasePagination.vue'

interface Props {
  page: number
  totalPages: number
  total: number
  pageSize: number
}

function mountComponent(props: Partial<Props> = {}) {
  return mount(BasePagination, {
    props: { page: 1, totalPages: 3, total: 20, pageSize: 8, ...props },
  })
}

/** Sequência de páginas e reticências entre os botões Anterior e Próxima. */
function window(wrapper: VueWrapper): (number | '…')[] {
  const children = [...wrapper.find('nav > div').element.children].slice(1, -1)
  return children.map((el) => (el.tagName === 'SPAN' ? '…' : Number(el.textContent?.trim())))
}

const previous = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Página anterior"]')
const proxima = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Próxima página"]')
const goTo = (wrapper: VueWrapper, page: number) =>
  wrapper.get(`button[aria-label="Ir para a página ${page}"]`)

const rangeText = (wrapper: VueWrapper) => wrapper.get('p').text()

describe('janela de páginas', () => {
  it('1 página: só a página 1', () => {
    expect(window(mountComponent({ page: 1, totalPages: 1, total: 5 }))).toEqual([1])
  })

  it('5 páginas: mostra todas, sem reticências, em qualquer página atual', () => {
    for (const page of [1, 3, 5]) {
      expect(window(mountComponent({ page, totalPages: 5, total: 40 }))).toEqual([1, 2, 3, 4, 5])
    }
  })

  it('7 páginas ainda mostra todas', () => {
    expect(window(mountComponent({ page: 4, totalPages: 7, total: 56 }))).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it.each([
    [1, [1, 2, '…', 20]],
    [2, [1, 2, 3, '…', 20]],
    [3, [1, 2, 3, 4, '…', 20]],
    [4, [1, '…', 3, 4, 5, '…', 20]],
    [10, [1, '…', 9, 10, 11, '…', 20]],
    [17, [1, '…', 16, 17, 18, '…', 20]],
    [18, [1, '…', 17, 18, 19, 20]],
    [19, [1, '…', 18, 19, 20]],
    [20, [1, '…', 19, 20]],
  ])('20 páginas, página atual %i', (page, expected) => {
    expect(window(mountComponent({ page, totalPages: 20, total: 160 }))).toEqual(expected)
  })

  it('8 páginas (primeiro valor acima do limite de 7) já usa reticências', () => {
    expect(window(mountComponent({ page: 1, totalPages: 8, total: 64 }))).toEqual([1, 2, '…', 8])
    expect(window(mountComponent({ page: 4, totalPages: 8, total: 64 }))).toEqual([1, '…', 3, 4, 5, '…', 8])
  })

  it('a janela nunca repete nem desordena páginas e sempre inclui a primeira, a última e a atual', () => {
    for (let page = 1; page <= 20; page += 1) {
      const numbers = window(mountComponent({ page, totalPages: 20, total: 160 })).filter(
        (item): item is number => item !== '…',
      )

      expect(numbers).toEqual([...new Set(numbers)].sort((a, b) => a - b))
      expect(numbers).toContain(1)
      expect(numbers).toContain(20)
      expect(numbers).toContain(page)
    }
  })

  it('reage à mudança da página atual', async () => {
    const wrapper = mountComponent({ page: 1, totalPages: 20, total: 160 })
    expect(window(wrapper)).toEqual([1, 2, '…', 20])

    await wrapper.setProps({ page: 10 })

    expect(window(wrapper)).toEqual([1, '…', 9, 10, 11, '…', 20])
  })
})

describe('texto do intervalo exibido', () => {
  it('primeira página', () => {
    expect(rangeText(mountComponent({ page: 1, pageSize: 8, total: 20 }))).toBe(
      'Mostrando 1–8 de 20 registros',
    )
  })

  it('página do meio: página 2, tamanho 8, total 20 mostra 9–16', () => {
    expect(rangeText(mountComponent({ page: 2, pageSize: 8, total: 20 }))).toBe(
      'Mostrando 9–16 de 20 registros',
    )
  })

  it('última página limita o fim ao total', () => {
    expect(rangeText(mountComponent({ page: 3, pageSize: 8, total: 20 }))).toBe(
      'Mostrando 17–20 de 20 registros',
    )
  })

  it('total menor que o tamanho da página', () => {
    expect(rangeText(mountComponent({ page: 1, totalPages: 1, pageSize: 8, total: 5 }))).toBe(
      'Mostrando 1–5 de 5 registros',
    )
  })

  it('total 0: a paginação inteira fica oculta, sem intervalo "0–0"', () => {
    const wrapper = mountComponent({ page: 1, totalPages: 1, total: 0 })

    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('reage à mudança de página', async () => {
    const wrapper = mountComponent({ page: 1, pageSize: 8, total: 20 })

    await wrapper.setProps({ page: 2 })

    expect(rangeText(wrapper)).toBe('Mostrando 9–16 de 20 registros')
  })
})

describe('acessibilidade', () => {
  it('é uma navegação rotulada e marca só a página atual com aria-current', () => {
    const wrapper = mountComponent({ page: 2, totalPages: 5, total: 40 })

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Paginação')
    expect(goTo(wrapper, 2).attributes('aria-current')).toBe('page')
    for (const other of [1, 3, 4, 5]) {
      expect(goTo(wrapper, other).attributes('aria-current')).toBeUndefined()
    }
  })
})

describe('events', () => {
  it('clicar em uma página emite mudar com o número', async () => {
    const wrapper = mountComponent({ page: 1, totalPages: 5, total: 40 })

    await goTo(wrapper, 4).trigger('click')

    expect(wrapper.emitted('change')).toEqual([[4]])
  })

  it('clicar na página atual emite o próprio número (comportamento atual, sem guarda)', async () => {
    const wrapper = mountComponent({ page: 2, totalPages: 5, total: 40 })

    await goTo(wrapper, 2).trigger('click')

    expect(wrapper.emitted('change')).toEqual([[2]])
  })

  it('Anterior emite pagina - 1 e Próxima emite pagina + 1', async () => {
    const wrapper = mountComponent({ page: 3, totalPages: 5, total: 40 })

    await previous(wrapper).trigger('click')
    await proxima(wrapper).trigger('click')

    expect(wrapper.emitted('change')).toEqual([[2], [4]])
  })

  it('clicar em uma página da janela com reticências emite o número correto', async () => {
    const wrapper = mountComponent({ page: 10, totalPages: 20, total: 160 })

    await goTo(wrapper, 20).trigger('click')
    await goTo(wrapper, 1).trigger('click')

    expect(wrapper.emitted('change')).toEqual([[20], [1]])
  })
})

describe('Anterior e Próxima desabilitados nas pontas', () => {
  it('Anterior fica desabilitado na primeira página e não emite', async () => {
    const wrapper = mountComponent({ page: 1, totalPages: 5, total: 40 })

    expect(previous(wrapper).attributes('disabled')).toBeDefined()
    expect(proxima(wrapper).attributes('disabled')).toBeUndefined()

    await previous(wrapper).trigger('click')

    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('Próxima fica desabilitada na última página e não emite', async () => {
    const wrapper = mountComponent({ page: 5, totalPages: 5, total: 40 })

    expect(proxima(wrapper).attributes('disabled')).toBeDefined()
    expect(previous(wrapper).attributes('disabled')).toBeUndefined()

    await proxima(wrapper).trigger('click')

    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('com uma única página os dois ficam desabilitados', () => {
    const wrapper = mountComponent({ page: 1, totalPages: 1, total: 5 })

    expect(previous(wrapper).attributes('disabled')).toBeDefined()
    expect(proxima(wrapper).attributes('disabled')).toBeDefined()
  })

  it('no meio os dois ficam habilitados', () => {
    const wrapper = mountComponent({ page: 3, totalPages: 5, total: 40 })

    expect(previous(wrapper).attributes('disabled')).toBeUndefined()
    expect(proxima(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('reage à mudança de página', async () => {
    const wrapper = mountComponent({ page: 1, totalPages: 5, total: 40 })

    await wrapper.setProps({ page: 5 })

    expect(previous(wrapper).attributes('disabled')).toBeUndefined()
    expect(proxima(wrapper).attributes('disabled')).toBeDefined()
  })
})

describe('navegação nunca emite página fora do intervalo', () => {
  it.each([1, 5, 20])('%i páginas: clicar em todos os botões, em toda página atual, só emite páginas válidas', async (totalPages) => {
    for (let page = 1; page <= totalPages; page += 1) {
      const wrapper = mountComponent({ page, totalPages, total: totalPages * 8 })

      for (const button of wrapper.findAll('button')) await button.trigger('click')

      const emittedPages = (wrapper.emitted('change') ?? []).map(([amount]) => amount as number)
      for (const amount of emittedPages) {
        expect(amount).toBeGreaterThanOrEqual(1)
        expect(amount).toBeLessThanOrEqual(totalPages)
      }
    }
  })
})
