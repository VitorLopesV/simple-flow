import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, type VNodeChild } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'

type Props = InstanceType<typeof BaseModal>['$props']

const montados: VueWrapper[] = []
const removiveis: HTMLElement[] = []

/** Conteúdo padrão: dois elementos focáveis no corpo do modal. */
const conteudoPadrao = () => [
  h('input', { id: 'campo-a', type: 'text' }),
  h('button', { id: 'botao-b', type: 'button' }, 'B'),
]

/**
 * Monta ligado como `v-model:aberto` (fechar de dentro remove o conteúdo) e preso ao documento.
 * `Teleport` vem stubado: o conteúdo fica dentro do wrapper.
 */
function montar(
  props: Partial<Props> = {},
  slots: { default?: () => VNodeChild; rodape?: () => VNodeChild } = { default: conteudoPadrao },
) {
  const wrapper: VueWrapper = mount(BaseModal, {
    props: {
      titulo: 'Título do modal',
      aberto: true,
      'onUpdate:aberto': (valor: boolean) => wrapper.setProps({ aberto: valor }),
      ...props,
    } as Props,
    slots,
    attachTo: document.body,
    global: { stubs: { teleport: true } },
  })
  montados.push(wrapper)
  return wrapper
}

/** Abre um modal que começou fechado, como o app faz, e espera o foco inicial ser aplicado. */
async function abrir(wrapper: VueWrapper) {
  await wrapper.setProps({ aberto: true })
  await nextTick()
  await nextTick()
}

const dialogo = (wrapper: VueWrapper) => wrapper.find('[role="dialog"]')
const fundo = (wrapper: VueWrapper) => dialogo(wrapper).element.parentElement as HTMLElement
const botaoFechar = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Fechar"]')
const elementoFechar = (wrapper: VueWrapper) => botaoFechar(wrapper).element as HTMLElement
const porId = (id: string) => document.getElementById(id) as HTMLElement

/** Dispara uma tecla no elemento (borbulha até o fundo do modal) e diz se o padrão foi impedido. */
function teclar(alvo: Element, key: string, opcoes: { shiftKey?: boolean } = {}): boolean {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opcoes })
  alvo.dispatchEvent(evento)
  return evento.defaultPrevented
}

afterEach(() => {
  while (montados.length) montados.pop()!.unmount()
  while (removiveis.length) removiveis.pop()!.remove()
  document.body.style.overflow = ''
  vi.restoreAllMocks()
})

describe('estrutura e acessibilidade', () => {
  it('fechado não renderiza nada', () => {
    const wrapper = montar({ aberto: false })

    expect(dialogo(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('aberto expõe role="dialog" e aria-modal="true"', () => {
    const modal = dialogo(montar())

    expect(modal.exists()).toBe(true)
    expect(modal.attributes('aria-modal')).toBe('true')
  })

  it('é rotulado pelo título', () => {
    const wrapper = montar({ titulo: 'Novo lançamento' })

    const titulo = wrapper.get('h2')
    expect(titulo.text()).toBe('Novo lançamento')
    expect(dialogo(wrapper).attributes('aria-labelledby')).toBe(titulo.attributes('id'))
  })

  it('descrição opcional: aparece e é ligada por aria-describedby', () => {
    const wrapper = montar({ descricao: 'Preencha os dados abaixo.' })

    const descricao = wrapper.get('h2 + p')
    expect(descricao.text()).toBe('Preencha os dados abaixo.')
    expect(dialogo(wrapper).attributes('aria-describedby')).toBe(descricao.attributes('id'))
  })

  it('sem descrição não há aria-describedby', () => {
    expect(dialogo(montar()).attributes('aria-describedby')).toBeUndefined()
  })

  it('renderiza o conteúdo e só mostra o rodapé quando o slot existe', () => {
    const sem = montar()
    expect(sem.find('footer').exists()).toBe(false)
    expect(sem.find('#campo-a').exists()).toBe(true)

    const com = montar({}, { default: conteudoPadrao, rodape: () => h('button', { id: 'salvar' }, 'Salvar') })
    expect(com.get('footer').text()).toBe('Salvar')
  })

  it.each([
    ['sm', 'max-w-sm'],
    ['md', 'max-w-lg'],
    ['lg', 'max-w-2xl'],
  ] as const)('largura %s usa %s', (largura, classe) => {
    expect(dialogo(montar({ largura })).classes()).toContain(classe)
  })

  it('a largura padrão é md', () => {
    expect(dialogo(montar()).classes()).toContain('max-w-lg')
  })

  it('reflete a mudança do título', async () => {
    const wrapper = montar({ titulo: 'Antes' })

    await wrapper.setProps({ titulo: 'Depois' })

    expect(wrapper.get('h2').text()).toBe('Depois')
  })
})

describe('foco', () => {
  it('ao abrir, o foco vai para o primeiro campo dentro do modal', async () => {
    const wrapper = montar({ aberto: false })

    await abrir(wrapper)

    expect(document.activeElement).toBe(porId('campo-a'))
    expect(dialogo(wrapper).element.contains(document.activeElement)).toBe(true)
  })

  it('o botão Fechar do cabeçalho nunca é o foco inicial', async () => {
    const wrapper = montar({ aberto: false }, { default: () => h('button', { id: 'so-botao' }, 'Ok') })

    await abrir(wrapper)

    expect(document.activeElement).toBe(porId('so-botao'))
    expect(document.activeElement).not.toBe(elementoFechar(wrapper))
  })

  it('sem elemento focável no conteúdo o foco não é movido', async () => {
    const antes = document.createElement('button')
    document.body.append(antes)
    removiveis.push(antes)
    antes.focus()
    const wrapper = montar({ aberto: false }, { default: () => h('p', 'Só texto') })

    await abrir(wrapper)

    expect(document.activeElement).toBe(antes)
  })

  it('ao fechar, o foco volta ao elemento que abriu', async () => {
    const gatilho = document.createElement('button')
    gatilho.textContent = 'Abrir'
    document.body.append(gatilho)
    removiveis.push(gatilho)
    gatilho.focus()
    const wrapper = montar({ aberto: false })

    await abrir(wrapper)
    expect(document.activeElement).toBe(porId('campo-a'))

    await wrapper.setProps({ aberto: false })

    expect(document.activeElement).toBe(gatilho)
  })

  it('cada abertura guarda o elemento que a originou', async () => {
    const primeiro = document.createElement('button')
    const segundo = document.createElement('button')
    document.body.append(primeiro, segundo)
    removiveis.push(primeiro, segundo)
    const wrapper = montar({ aberto: false })

    primeiro.focus()
    await abrir(wrapper)
    await wrapper.setProps({ aberto: false })
    expect(document.activeElement).toBe(primeiro)

    segundo.focus()
    await abrir(wrapper)
    await wrapper.setProps({ aberto: false })
    expect(document.activeElement).toBe(segundo)
  })
})

describe('focus-trap (Tab / Shift+Tab)', () => {
  // Ordem dos focáveis no modal: [Fechar (cabeçalho), campo-a, botao-b].
  it('Tab no último elemento volta ao primeiro (o botão Fechar) e impede o padrão', async () => {
    const wrapper = montar({ aberto: false })
    await abrir(wrapper)
    porId('botao-b').focus()

    const impedido = teclar(porId('botao-b'), 'Tab')

    expect(impedido).toBe(true)
    expect(document.activeElement).toBe(elementoFechar(wrapper))
  })

  it('Shift+Tab no primeiro elemento vai ao último e impede o padrão', async () => {
    const wrapper = montar({ aberto: false })
    await abrir(wrapper)
    elementoFechar(wrapper).focus()

    const impedido = teclar(elementoFechar(wrapper), 'Tab', { shiftKey: true })

    expect(impedido).toBe(true)
    expect(document.activeElement).toBe(porId('botao-b'))
  })

  it('Tab no meio não é interceptado (o navegador segue a ordem natural)', async () => {
    const wrapper = montar({ aberto: false })
    await abrir(wrapper)
    porId('campo-a').focus()

    expect(teclar(porId('campo-a'), 'Tab')).toBe(false)
    expect(document.activeElement).toBe(porId('campo-a'))
  })

  it('Shift+Tab no meio e Tab no primeiro não são interceptados', async () => {
    const wrapper = montar({ aberto: false })
    await abrir(wrapper)

    porId('campo-a').focus()
    expect(teclar(porId('campo-a'), 'Tab', { shiftKey: true })).toBe(false)

    elementoFechar(wrapper).focus()
    expect(teclar(elementoFechar(wrapper), 'Tab')).toBe(false)
    expect(document.activeElement).toBe(elementoFechar(wrapper))
  })

  it('o rodapé entra no ciclo: Tab no último botão do rodapé volta ao primeiro', async () => {
    const wrapper = montar(
      { aberto: false },
      { default: conteudoPadrao, rodape: () => h('button', { id: 'salvar', type: 'button' }, 'Salvar') },
    )
    await abrir(wrapper)
    porId('salvar').focus()

    expect(teclar(porId('salvar'), 'Tab')).toBe(true)
    expect(document.activeElement).toBe(elementoFechar(wrapper))

    expect(teclar(elementoFechar(wrapper), 'Tab', { shiftKey: true })).toBe(true)
    expect(document.activeElement).toBe(porId('salvar'))
  })

  it('botões desabilitados e tabindex="-1" ficam fora do ciclo', async () => {
    const wrapper = montar(
      { aberto: false },
      {
        default: () => [
          h('button', { id: 'ultimo-habilitado', type: 'button' }, 'Ok'),
          h('button', { id: 'desabilitado', type: 'button', disabled: true }, 'X'),
          h('div', { id: 'fora-da-ordem', tabindex: '-1' }, 'não focável por Tab'),
        ],
      },
    )
    await abrir(wrapper)
    porId('ultimo-habilitado').focus()

    expect(teclar(porId('ultimo-habilitado'), 'Tab')).toBe(true)
    expect(document.activeElement).toBe(elementoFechar(wrapper))
  })

  it('outras teclas não são interceptadas', async () => {
    const wrapper = montar({ aberto: false })
    await abrir(wrapper)
    porId('botao-b').focus()

    expect(teclar(porId('botao-b'), 'a')).toBe(false)
    expect(teclar(porId('botao-b'), 'Enter')).toBe(false)
    expect(document.activeElement).toBe(porId('botao-b'))
  })

  it('percorrer o ciclo inteiro nas duas direções nunca leva o foco para fora do modal', async () => {
    const wrapper = montar({ aberto: false })
    await abrir(wrapper)
    const dentro = () => dialogo(wrapper).element.contains(document.activeElement)
    const ordem = [elementoFechar(wrapper), porId('campo-a'), porId('botao-b')]

    // Simula o Tab do navegador: avança um a um e só passa a mão ao modal nas pontas.
    let indice = 0
    ordem[indice]!.focus()
    for (let passo = 0; passo < 9; passo += 1) {
      const atual = ordem[indice]!
      const interceptado = teclar(atual, 'Tab')
      indice = interceptado ? 0 : indice + 1
      if (!interceptado) ordem[indice]!.focus()
      expect(dentro()).toBe(true)
    }

    ordem[indice]!.focus()
    for (let passo = 0; passo < 9; passo += 1) {
      const atual = ordem[indice]!
      const interceptado = teclar(atual, 'Tab', { shiftKey: true })
      indice = interceptado ? ordem.length - 1 : indice - 1
      if (!interceptado) ordem[indice]!.focus()
      expect(dentro()).toBe(true)
    }
  })
})

describe('fechar', () => {
  it('Esc fecha o modal', async () => {
    const wrapper = montar()

    teclar(dialogo(wrapper).element, 'Escape')
    await nextTick()

    expect(wrapper.emitted('update:aberto')).toEqual([[false]])
    expect(dialogo(wrapper).exists()).toBe(false)
  })

  it('Esc não propaga para fora do modal', async () => {
    const wrapper = montar()
    const ouvinte = vi.fn()
    document.addEventListener('keydown', ouvinte)

    teclar(porId('campo-a'), 'Escape')
    await nextTick()
    document.removeEventListener('keydown', ouvinte)

    expect(ouvinte).not.toHaveBeenCalled()
    expect(dialogo(wrapper).exists()).toBe(false)
  })

  it('outras teclas não fecham o modal', async () => {
    const wrapper = montar()

    teclar(porId('campo-a'), 'Enter')
    teclar(porId('campo-a'), 'a')
    await nextTick()

    expect(dialogo(wrapper).exists()).toBe(true)
    expect(wrapper.emitted('update:aberto')).toBeUndefined()
  })

  it('clique no backdrop fecha', async () => {
    const wrapper = montar()

    fundo(wrapper).click()
    await nextTick()

    expect(wrapper.emitted('update:aberto')).toEqual([[false]])
    expect(dialogo(wrapper).exists()).toBe(false)
  })

  it('clique dentro do painel (corpo, título) não fecha', async () => {
    const wrapper = montar()

    await dialogo(wrapper).trigger('click')
    await wrapper.get('#campo-a').trigger('click')
    await wrapper.get('h2').trigger('click')

    expect(dialogo(wrapper).exists()).toBe(true)
    expect(wrapper.emitted('update:aberto')).toBeUndefined()
  })

  it('o botão Fechar (X) fecha e tem nome acessível', async () => {
    const wrapper = montar()

    await botaoFechar(wrapper).trigger('click')

    expect(wrapper.emitted('update:aberto')).toEqual([[false]])
    expect(dialogo(wrapper).exists()).toBe(false)
  })
})

describe('scroll-lock do body', () => {
  it('abrir bloqueia o scroll do body e fechar restaura', async () => {
    const wrapper = montar({ aberto: false })
    expect(document.body.style.overflow).toBe('')

    await abrir(wrapper)
    expect(document.body.style.overflow).toBe('hidden')

    await wrapper.setProps({ aberto: false })
    expect(document.body.style.overflow).toBe('')
  })

  it('fechar por Esc, backdrop e X também restaura', async () => {
    const wrapper = montar({ aberto: false })

    for (const fechar of [
      () => teclar(dialogo(wrapper).element, 'Escape'),
      () => fundo(wrapper).click(),
      () => elementoFechar(wrapper).click(),
    ]) {
      await abrir(wrapper)
      expect(document.body.style.overflow).toBe('hidden')

      fechar()
      await nextTick()
      await nextTick()

      expect(document.body.style.overflow).toBe('')
    }
  })

  it('desmontar com o modal aberto restaura o scroll', async () => {
    const wrapper = montar({ aberto: false })
    await abrir(wrapper)
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    montados.splice(montados.indexOf(wrapper), 1)

    expect(document.body.style.overflow).toBe('')
  })

  it('desmontar com o modal fechado também deixa o body liberado', () => {
    const wrapper = montar({ aberto: false })

    wrapper.unmount()
    montados.splice(montados.indexOf(wrapper), 1)

    expect(document.body.style.overflow).toBe('')
  })

  // Comportamento atual, registrado de propósito: o bloqueio e o foco inicial dependem da
  // *mudança* de `aberto`; um modal já montado aberto não bloqueia o scroll nem move o foco.
  it('(comportamento atual) montar já aberto não bloqueia o scroll', () => {
    montar({ aberto: true })

    expect(document.body.style.overflow).toBe('')
  })
})

describe('sem vazamento após desmontar', () => {
  it('não deixa o diálogo, o estilo do body nem listeners globais para trás', async () => {
    const adicionarDoc = vi.spyOn(document, 'addEventListener')
    const removerDoc = vi.spyOn(document, 'removeEventListener')
    const adicionarJanela = vi.spyOn(window, 'addEventListener')
    const removerJanela = vi.spyOn(window, 'removeEventListener')
    const wrapper = montar({ aberto: false })

    await abrir(wrapper)
    teclar(porId('botao-b'), 'Tab')
    await wrapper.setProps({ aberto: false })
    await abrir(wrapper)
    wrapper.unmount()
    montados.splice(montados.indexOf(wrapper), 1)

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    // Todo listener registrado em document/window precisa ter sido removido.
    expect(adicionarDoc.mock.calls.filter(([tipo]) => tipo === 'keydown')).toHaveLength(
      removerDoc.mock.calls.filter(([tipo]) => tipo === 'keydown').length,
    )
    expect(adicionarDoc.mock.calls.length).toBeLessThanOrEqual(removerDoc.mock.calls.length)
    expect(adicionarJanela.mock.calls.length).toBeLessThanOrEqual(removerJanela.mock.calls.length)
  })

  it('depois de desmontado, teclas e cliques no documento não geram erro nem efeito', async () => {
    const wrapper = montar({ aberto: false })
    await abrir(wrapper)

    wrapper.unmount()
    montados.splice(montados.indexOf(wrapper), 1)

    expect(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      document.body.click()
    }).not.toThrow()
    expect(document.body.style.overflow).toBe('')
  })
})
