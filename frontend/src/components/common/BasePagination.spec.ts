import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BasePagination from '@/components/common/BasePagination.vue'

interface Props {
  pagina: number
  totalPaginas: number
  total: number
  tamanhoPagina: number
}

function montar(props: Partial<Props> = {}) {
  return mount(BasePagination, {
    props: { pagina: 1, totalPaginas: 3, total: 20, tamanhoPagina: 8, ...props },
  })
}

/** Sequência de páginas e reticências entre os botões Anterior e Próxima. */
function janela(wrapper: VueWrapper): (number | '…')[] {
  const filhos = [...wrapper.find('nav > div').element.children].slice(1, -1)
  return filhos.map((el) => (el.tagName === 'SPAN' ? '…' : Number(el.textContent?.trim())))
}

const anterior = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Página anterior"]')
const proxima = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Próxima página"]')
const irPara = (wrapper: VueWrapper, pagina: number) =>
  wrapper.get(`button[aria-label="Ir para a página ${pagina}"]`)

const textoDoIntervalo = (wrapper: VueWrapper) => wrapper.get('p').text()

describe('janela de páginas', () => {
  it('1 página: só a página 1', () => {
    expect(janela(montar({ pagina: 1, totalPaginas: 1, total: 5 }))).toEqual([1])
  })

  it('5 páginas: mostra todas, sem reticências, em qualquer página atual', () => {
    for (const pagina of [1, 3, 5]) {
      expect(janela(montar({ pagina, totalPaginas: 5, total: 40 }))).toEqual([1, 2, 3, 4, 5])
    }
  })

  it('7 páginas ainda mostra todas', () => {
    expect(janela(montar({ pagina: 4, totalPaginas: 7, total: 56 }))).toEqual([1, 2, 3, 4, 5, 6, 7])
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
  ])('20 páginas, página atual %i', (pagina, esperado) => {
    expect(janela(montar({ pagina, totalPaginas: 20, total: 160 }))).toEqual(esperado)
  })

  it('8 páginas (primeiro valor acima do limite de 7) já usa reticências', () => {
    expect(janela(montar({ pagina: 1, totalPaginas: 8, total: 64 }))).toEqual([1, 2, '…', 8])
    expect(janela(montar({ pagina: 4, totalPaginas: 8, total: 64 }))).toEqual([1, '…', 3, 4, 5, '…', 8])
  })

  it('a janela nunca repete nem desordena páginas e sempre inclui a primeira, a última e a atual', () => {
    for (let pagina = 1; pagina <= 20; pagina += 1) {
      const numeros = janela(montar({ pagina, totalPaginas: 20, total: 160 })).filter(
        (item): item is number => item !== '…',
      )

      expect(numeros).toEqual([...new Set(numeros)].sort((a, b) => a - b))
      expect(numeros).toContain(1)
      expect(numeros).toContain(20)
      expect(numeros).toContain(pagina)
    }
  })

  it('reage à mudança da página atual', async () => {
    const wrapper = montar({ pagina: 1, totalPaginas: 20, total: 160 })
    expect(janela(wrapper)).toEqual([1, 2, '…', 20])

    await wrapper.setProps({ pagina: 10 })

    expect(janela(wrapper)).toEqual([1, '…', 9, 10, 11, '…', 20])
  })
})

describe('texto do intervalo exibido', () => {
  it('primeira página', () => {
    expect(textoDoIntervalo(montar({ pagina: 1, tamanhoPagina: 8, total: 20 }))).toBe(
      'Mostrando 1–8 de 20 registros',
    )
  })

  it('página do meio: página 2, tamanho 8, total 20 mostra 9–16', () => {
    expect(textoDoIntervalo(montar({ pagina: 2, tamanhoPagina: 8, total: 20 }))).toBe(
      'Mostrando 9–16 de 20 registros',
    )
  })

  it('última página limita o fim ao total', () => {
    expect(textoDoIntervalo(montar({ pagina: 3, tamanhoPagina: 8, total: 20 }))).toBe(
      'Mostrando 17–20 de 20 registros',
    )
  })

  it('total menor que o tamanho da página', () => {
    expect(textoDoIntervalo(montar({ pagina: 1, totalPaginas: 1, tamanhoPagina: 8, total: 5 }))).toBe(
      'Mostrando 1–5 de 5 registros',
    )
  })

  it('total 0: a paginação inteira fica oculta, sem intervalo "0–0"', () => {
    const wrapper = montar({ pagina: 1, totalPaginas: 1, total: 0 })

    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('reage à mudança de página', async () => {
    const wrapper = montar({ pagina: 1, tamanhoPagina: 8, total: 20 })

    await wrapper.setProps({ pagina: 2 })

    expect(textoDoIntervalo(wrapper)).toBe('Mostrando 9–16 de 20 registros')
  })
})

describe('acessibilidade', () => {
  it('é uma navegação rotulada e marca só a página atual com aria-current', () => {
    const wrapper = montar({ pagina: 2, totalPaginas: 5, total: 40 })

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Paginação')
    expect(irPara(wrapper, 2).attributes('aria-current')).toBe('page')
    for (const outra of [1, 3, 4, 5]) {
      expect(irPara(wrapper, outra).attributes('aria-current')).toBeUndefined()
    }
  })
})

describe('eventos', () => {
  it('clicar em uma página emite mudar com o número', async () => {
    const wrapper = montar({ pagina: 1, totalPaginas: 5, total: 40 })

    await irPara(wrapper, 4).trigger('click')

    expect(wrapper.emitted('mudar')).toEqual([[4]])
  })

  it('clicar na página atual emite o próprio número (comportamento atual, sem guarda)', async () => {
    const wrapper = montar({ pagina: 2, totalPaginas: 5, total: 40 })

    await irPara(wrapper, 2).trigger('click')

    expect(wrapper.emitted('mudar')).toEqual([[2]])
  })

  it('Anterior emite pagina - 1 e Próxima emite pagina + 1', async () => {
    const wrapper = montar({ pagina: 3, totalPaginas: 5, total: 40 })

    await anterior(wrapper).trigger('click')
    await proxima(wrapper).trigger('click')

    expect(wrapper.emitted('mudar')).toEqual([[2], [4]])
  })

  it('clicar em uma página da janela com reticências emite o número correto', async () => {
    const wrapper = montar({ pagina: 10, totalPaginas: 20, total: 160 })

    await irPara(wrapper, 20).trigger('click')
    await irPara(wrapper, 1).trigger('click')

    expect(wrapper.emitted('mudar')).toEqual([[20], [1]])
  })
})

describe('Anterior e Próxima desabilitados nas pontas', () => {
  it('Anterior fica desabilitado na primeira página e não emite', async () => {
    const wrapper = montar({ pagina: 1, totalPaginas: 5, total: 40 })

    expect(anterior(wrapper).attributes('disabled')).toBeDefined()
    expect(proxima(wrapper).attributes('disabled')).toBeUndefined()

    await anterior(wrapper).trigger('click')

    expect(wrapper.emitted('mudar')).toBeUndefined()
  })

  it('Próxima fica desabilitada na última página e não emite', async () => {
    const wrapper = montar({ pagina: 5, totalPaginas: 5, total: 40 })

    expect(proxima(wrapper).attributes('disabled')).toBeDefined()
    expect(anterior(wrapper).attributes('disabled')).toBeUndefined()

    await proxima(wrapper).trigger('click')

    expect(wrapper.emitted('mudar')).toBeUndefined()
  })

  it('com uma única página os dois ficam desabilitados', () => {
    const wrapper = montar({ pagina: 1, totalPaginas: 1, total: 5 })

    expect(anterior(wrapper).attributes('disabled')).toBeDefined()
    expect(proxima(wrapper).attributes('disabled')).toBeDefined()
  })

  it('no meio os dois ficam habilitados', () => {
    const wrapper = montar({ pagina: 3, totalPaginas: 5, total: 40 })

    expect(anterior(wrapper).attributes('disabled')).toBeUndefined()
    expect(proxima(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('reage à mudança de página', async () => {
    const wrapper = montar({ pagina: 1, totalPaginas: 5, total: 40 })

    await wrapper.setProps({ pagina: 5 })

    expect(anterior(wrapper).attributes('disabled')).toBeUndefined()
    expect(proxima(wrapper).attributes('disabled')).toBeDefined()
  })
})

describe('navegação nunca emite página fora do intervalo', () => {
  it.each([1, 5, 20])('%i páginas: clicar em todos os botões, em toda página atual, só emite páginas válidas', async (totalPaginas) => {
    for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
      const wrapper = montar({ pagina, totalPaginas, total: totalPaginas * 8 })

      for (const botao of wrapper.findAll('button')) await botao.trigger('click')

      const emitidas = (wrapper.emitted('mudar') ?? []).map(([valor]) => valor as number)
      for (const valor of emitidas) {
        expect(valor).toBeGreaterThanOrEqual(1)
        expect(valor).toBeLessThanOrEqual(totalPaginas)
      }
    }
  })
})
