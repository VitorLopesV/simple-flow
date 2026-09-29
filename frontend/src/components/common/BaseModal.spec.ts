import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, type VNodeChild } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'

type Props = InstanceType<typeof BaseModal>['$props']

const mounted: VueWrapper[] = []
const removables: HTMLElement[] = []

/** Conteúdo padrão: dois elementos focáveis no corpo do modal. */
const defaultContent = () => [
  h('input', { id: 'campo-a', type: 'text' }),
  h('button', { id: 'botao-b', type: 'button' }, 'B'),
]

/**
 * Monta ligado como `v-model:aberto` (fechar de dentro remove o conteúdo) e preso ao documento.
 * `Teleport` vem stubado: o conteúdo fica dentro do wrapper.
 */
function mountComponent(
  props: Partial<Props> = {},
  slots: { default?: () => VNodeChild; footer?: () => VNodeChild } = { default: defaultContent },
) {
  const wrapper: VueWrapper = mount(BaseModal, {
    props: {
      title: 'Título do modal',
      open: true,
      'onUpdate:open': (amount: boolean) => wrapper.setProps({ open: amount }),
      ...props,
    } as Props,
    slots,
    attachTo: document.body,
    global: { stubs: { teleport: true } },
  })
  mounted.push(wrapper)
  return wrapper
}

/** Abre um modal que começou fechado, como o app faz, e espera o foco inicial ser aplicado. */
async function openModal(wrapper: VueWrapper) {
  await wrapper.setProps({ open: true })
  await nextTick()
  await nextTick()
}

const dialog = (wrapper: VueWrapper) => wrapper.find('[role="dialog"]')
const backdrop = (wrapper: VueWrapper) => dialog(wrapper).element.parentElement as HTMLElement
const closeButton = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Fechar"]')
const closeElement = (wrapper: VueWrapper) => closeButton(wrapper).element as HTMLElement
const byId = (id: string) => document.getElementById(id) as HTMLElement

/** Dispara uma tecla no elemento (borbulha até o fundo do modal) e diz se o padrão foi impedido. */
function pressKey(target: Element, key: string, options: { shiftKey?: boolean } = {}): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })
  target.dispatchEvent(event)
  return event.defaultPrevented
}

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  while (removables.length) removables.pop()!.remove()
  document.body.style.overflow = ''
  vi.restoreAllMocks()
})

describe('estrutura e acessibilidade', () => {
  it('fechado não renderiza nada', () => {
    const wrapper = mountComponent({ open: false })

    expect(dialog(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('aberto expõe role="dialog" e aria-modal="true"', () => {
    const modal = dialog(mountComponent())

    expect(modal.exists()).toBe(true)
    expect(modal.attributes('aria-modal')).toBe('true')
  })

  it('é rotulado pelo título', () => {
    const wrapper = mountComponent({ title: 'Novo lançamento' })

    const title = wrapper.get('h2')
    expect(title.text()).toBe('Novo lançamento')
    expect(dialog(wrapper).attributes('aria-labelledby')).toBe(title.attributes('id'))
  })

  it('descrição opcional: aparece e é ligada por aria-describedby', () => {
    const wrapper = mountComponent({ description: 'Preencha os dados abaixo.' })

    const description = wrapper.get('h2 + p')
    expect(description.text()).toBe('Preencha os dados abaixo.')
    expect(dialog(wrapper).attributes('aria-describedby')).toBe(description.attributes('id'))
  })

  it('sem descrição não há aria-describedby', () => {
    expect(dialog(mountComponent()).attributes('aria-describedby')).toBeUndefined()
  })

  it('renderiza o conteúdo e só mostra o rodapé quando o slot existe', () => {
    const withoutFooter = mountComponent()
    expect(withoutFooter.find('footer').exists()).toBe(false)
    expect(withoutFooter.find('#campo-a').exists()).toBe(true)

    const withFooter = mountComponent({}, { default: defaultContent, footer: () => h('button', { id: 'save' }, 'Salvar') })
    expect(withFooter.get('footer').text()).toBe('Salvar')
  })

  it.each([
    ['sm', 'max-w-sm'],
    ['md', 'max-w-lg'],
    ['lg', 'max-w-2xl'],
  ] as const)('largura %s usa %s', (width, classe) => {
    expect(dialog(mountComponent({ width })).classes()).toContain(classe)
  })

  it('a largura padrão é md', () => {
    expect(dialog(mountComponent()).classes()).toContain('max-w-lg')
  })

  it('reflete a mudança do título', async () => {
    const wrapper = mountComponent({ title: 'Antes' })

    await wrapper.setProps({ title: 'Depois' })

    expect(wrapper.get('h2').text()).toBe('Depois')
  })
})

describe('focus', () => {
  it('ao abrir, o foco vai para o primeiro campo dentro do modal', async () => {
    const wrapper = mountComponent({ open: false })

    await openModal(wrapper)

    expect(document.activeElement).toBe(byId('campo-a'))
    expect(dialog(wrapper).element.contains(document.activeElement)).toBe(true)
  })

  it('o botão Fechar do cabeçalho nunca é o foco inicial', async () => {
    const wrapper = mountComponent({ open: false }, { default: () => h('button', { id: 'so-botao' }, 'Ok') })

    await openModal(wrapper)

    expect(document.activeElement).toBe(byId('so-botao'))
    expect(document.activeElement).not.toBe(closeElement(wrapper))
  })

  it('sem elemento focável no conteúdo o foco não é movido', async () => {
    const before = document.createElement('button')
    document.body.append(before)
    removables.push(before)
    before.focus()
    const wrapper = mountComponent({ open: false }, { default: () => h('p', 'Só texto') })

    await openModal(wrapper)

    expect(document.activeElement).toBe(before)
  })

  it('ao fechar, o foco volta ao elemento que abriu', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Abrir'
    document.body.append(trigger)
    removables.push(trigger)
    trigger.focus()
    const wrapper = mountComponent({ open: false })

    await openModal(wrapper)
    expect(document.activeElement).toBe(byId('campo-a'))

    await wrapper.setProps({ open: false })

    expect(document.activeElement).toBe(trigger)
  })

  it('cada abertura guarda o elemento que a originou', async () => {
    const first = document.createElement('button')
    const second = document.createElement('button')
    document.body.append(first, second)
    removables.push(first, second)
    const wrapper = mountComponent({ open: false })

    first.focus()
    await openModal(wrapper)
    await wrapper.setProps({ open: false })
    expect(document.activeElement).toBe(first)

    second.focus()
    await openModal(wrapper)
    await wrapper.setProps({ open: false })
    expect(document.activeElement).toBe(second)
  })
})

describe('focus-trap (Tab / Shift+Tab)', () => {
  // Ordem dos focáveis no modal: [Fechar (cabeçalho), campo-a, botao-b].
  it('Tab no último elemento volta ao primeiro (o botão Fechar) e impede o padrão', async () => {
    const wrapper = mountComponent({ open: false })
    await openModal(wrapper)
    byId('botao-b').focus()

    const prevented = pressKey(byId('botao-b'), 'Tab')

    expect(prevented).toBe(true)
    expect(document.activeElement).toBe(closeElement(wrapper))
  })

  it('Shift+Tab no primeiro elemento vai ao último e impede o padrão', async () => {
    const wrapper = mountComponent({ open: false })
    await openModal(wrapper)
    closeElement(wrapper).focus()

    const prevented = pressKey(closeElement(wrapper), 'Tab', { shiftKey: true })

    expect(prevented).toBe(true)
    expect(document.activeElement).toBe(byId('botao-b'))
  })

  it('Tab no meio não é interceptado (o navegador segue a ordem natural)', async () => {
    const wrapper = mountComponent({ open: false })
    await openModal(wrapper)
    byId('campo-a').focus()

    expect(pressKey(byId('campo-a'), 'Tab')).toBe(false)
    expect(document.activeElement).toBe(byId('campo-a'))
  })

  it('Shift+Tab no meio e Tab no primeiro não são interceptados', async () => {
    const wrapper = mountComponent({ open: false })
    await openModal(wrapper)

    byId('campo-a').focus()
    expect(pressKey(byId('campo-a'), 'Tab', { shiftKey: true })).toBe(false)

    closeElement(wrapper).focus()
    expect(pressKey(closeElement(wrapper), 'Tab')).toBe(false)
    expect(document.activeElement).toBe(closeElement(wrapper))
  })

  it('o rodapé entra no ciclo: Tab no último botão do rodapé volta ao primeiro', async () => {
    const wrapper = mountComponent(
      { open: false },
      { default: defaultContent, footer: () => h('button', { id: 'save', type: 'button' }, 'Salvar') },
    )
    await openModal(wrapper)
    byId('save').focus()

    expect(pressKey(byId('save'), 'Tab')).toBe(true)
    expect(document.activeElement).toBe(closeElement(wrapper))

    expect(pressKey(closeElement(wrapper), 'Tab', { shiftKey: true })).toBe(true)
    expect(document.activeElement).toBe(byId('save'))
  })

  it('botões desabilitados e tabindex="-1" ficam fora do ciclo', async () => {
    const wrapper = mountComponent(
      { open: false },
      {
        default: () => [
          h('button', { id: 'ultimo-habilitado', type: 'button' }, 'Ok'),
          h('button', { id: 'disabled', type: 'button', disabled: true }, 'X'),
          h('div', { id: 'fora-da-ordem', tabindex: '-1' }, 'não focável por Tab'),
        ],
      },
    )
    await openModal(wrapper)
    byId('ultimo-habilitado').focus()

    expect(pressKey(byId('ultimo-habilitado'), 'Tab')).toBe(true)
    expect(document.activeElement).toBe(closeElement(wrapper))
  })

  it('outras teclas não são interceptadas', async () => {
    const wrapper = mountComponent({ open: false })
    await openModal(wrapper)
    byId('botao-b').focus()

    expect(pressKey(byId('botao-b'), 'a')).toBe(false)
    expect(pressKey(byId('botao-b'), 'Enter')).toBe(false)
    expect(document.activeElement).toBe(byId('botao-b'))
  })

  it('percorrer o ciclo inteiro nas duas direções nunca leva o foco para fora do modal', async () => {
    const wrapper = mountComponent({ open: false })
    await openModal(wrapper)
    const inside = () => dialog(wrapper).element.contains(document.activeElement)
    const order = [closeElement(wrapper), byId('campo-a'), byId('botao-b')]

    // Simula o Tab do navegador: avança um a um e só passa a mão ao modal nas pontas.
    let index = 0
    order[index]!.focus()
    for (let passo = 0; passo < 9; passo += 1) {
      const current = order[index]!
      const intercepted = pressKey(current, 'Tab')
      index = intercepted ? 0 : index + 1
      if (!intercepted) order[index]!.focus()
      expect(inside()).toBe(true)
    }

    order[index]!.focus()
    for (let passo = 0; passo < 9; passo += 1) {
      const current = order[index]!
      const intercepted = pressKey(current, 'Tab', { shiftKey: true })
      index = intercepted ? order.length - 1 : index - 1
      if (!intercepted) order[index]!.focus()
      expect(inside()).toBe(true)
    }
  })
})

describe('close', () => {
  it('Esc fecha o modal', async () => {
    const wrapper = mountComponent()

    pressKey(dialog(wrapper).element, 'Escape')
    await nextTick()

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(dialog(wrapper).exists()).toBe(false)
  })

  it('Esc não propaga para fora do modal', async () => {
    const wrapper = mountComponent()
    const ouvinte = vi.fn()
    document.addEventListener('keydown', ouvinte)

    pressKey(byId('campo-a'), 'Escape')
    await nextTick()
    document.removeEventListener('keydown', ouvinte)

    expect(ouvinte).not.toHaveBeenCalled()
    expect(dialog(wrapper).exists()).toBe(false)
  })

  it('outras teclas não fecham o modal', async () => {
    const wrapper = mountComponent()

    pressKey(byId('campo-a'), 'Enter')
    pressKey(byId('campo-a'), 'a')
    await nextTick()

    expect(dialog(wrapper).exists()).toBe(true)
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('clique no backdrop fecha', async () => {
    const wrapper = mountComponent()

    backdrop(wrapper).click()
    await nextTick()

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(dialog(wrapper).exists()).toBe(false)
  })

  it('clique dentro do painel (corpo, título) não fecha', async () => {
    const wrapper = mountComponent()

    await dialog(wrapper).trigger('click')
    await wrapper.get('#campo-a').trigger('click')
    await wrapper.get('h2').trigger('click')

    expect(dialog(wrapper).exists()).toBe(true)
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('o botão Fechar (X) fecha e tem nome acessível', async () => {
    const wrapper = mountComponent()

    await closeButton(wrapper).trigger('click')

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(dialog(wrapper).exists()).toBe(false)
  })
})

describe('scroll-lock do body', () => {
  it('abrir bloqueia o scroll do body e fechar restaura', async () => {
    const wrapper = mountComponent({ open: false })
    expect(document.body.style.overflow).toBe('')

    await openModal(wrapper)
    expect(document.body.style.overflow).toBe('hidden')

    await wrapper.setProps({ open: false })
    expect(document.body.style.overflow).toBe('')
  })

  it('fechar por Esc, backdrop e X também restaura', async () => {
    const wrapper = mountComponent({ open: false })

    for (const close of [
      () => pressKey(dialog(wrapper).element, 'Escape'),
      () => backdrop(wrapper).click(),
      () => closeElement(wrapper).click(),
    ]) {
      await openModal(wrapper)
      expect(document.body.style.overflow).toBe('hidden')

      close()
      await nextTick()
      await nextTick()

      expect(document.body.style.overflow).toBe('')
    }
  })

  it('desmontar com o modal aberto restaura o scroll', async () => {
    const wrapper = mountComponent({ open: false })
    await openModal(wrapper)
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    mounted.splice(mounted.indexOf(wrapper), 1)

    expect(document.body.style.overflow).toBe('')
  })

  it('desmontar com o modal fechado também deixa o body liberado', () => {
    const wrapper = mountComponent({ open: false })

    wrapper.unmount()
    mounted.splice(mounted.indexOf(wrapper), 1)

    expect(document.body.style.overflow).toBe('')
  })

  // Comportamento atual, registrado de propósito: o bloqueio e o foco inicial dependem da
  // *mudança* de `aberto`; um modal já montado aberto não bloqueia o scroll nem move o foco.
  it('(comportamento atual) montar já aberto não bloqueia o scroll', () => {
    mountComponent({ open: true })

    expect(document.body.style.overflow).toBe('')
  })
})

describe('sem vazamento após desmontar', () => {
  it('não deixa o diálogo, o estilo do body nem listeners globais para trás', async () => {
    const docAdd = vi.spyOn(document, 'addEventListener')
    const docRemove = vi.spyOn(document, 'removeEventListener')
    const windowAdd = vi.spyOn(window, 'addEventListener')
    const windowRemove = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountComponent({ open: false })

    await openModal(wrapper)
    pressKey(byId('botao-b'), 'Tab')
    await wrapper.setProps({ open: false })
    await openModal(wrapper)
    wrapper.unmount()
    mounted.splice(mounted.indexOf(wrapper), 1)

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    // Todo listener registrado em document/window precisa ter sido removido.
    expect(docAdd.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(
      docRemove.mock.calls.filter(([type]) => type === 'keydown').length,
    )
    expect(docAdd.mock.calls.length).toBeLessThanOrEqual(docRemove.mock.calls.length)
    expect(windowAdd.mock.calls.length).toBeLessThanOrEqual(windowRemove.mock.calls.length)
  })

  it('depois de desmontado, teclas e cliques no documento não geram erro nem efeito', async () => {
    const wrapper = mountComponent({ open: false })
    await openModal(wrapper)

    wrapper.unmount()
    mounted.splice(mounted.indexOf(wrapper), 1)

    expect(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      document.body.click()
    }).not.toThrow()
    expect(document.body.style.overflow).toBe('')
  })
})
