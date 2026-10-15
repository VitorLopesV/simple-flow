import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

type Props = InstanceType<typeof ConfirmDialog>['$props']

const mounted: VueWrapper[] = []

/**
 * Monta ligado como `v-model:aberto` (fechar de dentro remove o conteúdo) e preso ao documento.
 * `Teleport` vem stubado por padrão: o conteúdo fica dentro do wrapper.
 */
function mountComponent(props: Partial<Props> = {}, { teleportReal = false } = {}) {
  const wrapper: VueWrapper = mount(ConfirmDialog, {
    props: {
      message: 'Excluir esta saída?',
      open: true,
      'onUpdate:open': (amount: boolean) => wrapper.setProps({ open: amount }),
      ...props,
    } as Props,
    attachTo: document.body,
    global: { stubs: { teleport: !teleportReal } },
  })
  mounted.push(wrapper)
  return wrapper
}

const dialog = (wrapper: VueWrapper) => wrapper.find('[role="dialog"]')
const button = (wrapper: VueWrapper, text: string) => {
  const found = wrapper.findAll('button').find((b) => b.text() === text)
  expect(found, `botão "${text}" não encontrado`).toBeDefined()
  return found!
}
const confirmButton = (wrapper: VueWrapper) => button(wrapper, 'Confirmar')
const cancelButton = (wrapper: VueWrapper) => button(wrapper, 'Cancelar')
const closeButton = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Fechar"]')

const isDisabled = (b: ReturnType<typeof confirmButton>) => b.attributes('disabled') !== undefined

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.style.overflow = ''
})

describe('aberto e fechado', () => {
  it('fechado não renderiza conteúdo', () => {
    const wrapper = mountComponent({ open: false })

    expect(dialog(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('aberto exibe o diálogo com título e mensagem recebidos', () => {
    const wrapper = mountComponent({ title: 'Excluir saída', message: 'Esta ação não pode ser desfeita.' })

    expect(dialog(wrapper).exists()).toBe(true)
    expect(wrapper.get('h2').text()).toBe('Excluir saída')
    expect(wrapper.get('p').text()).toBe('Esta ação não pode ser desfeita.')
  })

  it('abre e fecha conforme o valor externo', async () => {
    const wrapper = mountComponent({ open: false })

    await wrapper.setProps({ open: true })
    expect(dialog(wrapper).exists()).toBe(true)

    await wrapper.setProps({ open: false })
    expect(dialog(wrapper).exists()).toBe(false)
  })

  it('usa os textos padrão', () => {
    const wrapper = mountComponent()

    expect(wrapper.get('h2').text()).toBe('Confirmar ação')
    expect(confirmButton(wrapper).exists()).toBe(true)
    expect(cancelButton(wrapper).exists()).toBe(true)
  })

  it('aceita textos de confirmar e cancelar customizados', () => {
    const wrapper = mountComponent({ confirmText: 'Excluir', cancelText: 'Voltar' })

    expect(button(wrapper, 'Excluir').exists()).toBe(true)
    expect(button(wrapper, 'Voltar').exists()).toBe(true)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Confirmar')).toBe(false)
  })

  it('é um diálogo modal acessível, rotulado pelo título', () => {
    const wrapper = mountComponent({ title: 'Excluir saída' })
    const modal = dialog(wrapper)

    expect(modal.attributes('aria-modal')).toBe('true')
    expect(modal.attributes('aria-labelledby')).toBe(wrapper.get('h2').attributes('id'))
  })
})

describe('Teleport', () => {
  it('sem stub, o conteúdo vai para o document.body e não para dentro do wrapper', () => {
    const wrapper = mountComponent({ title: 'Excluir saída' }, { teleportReal: true })

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    const noBody = document.body.querySelector('[role="dialog"]')
    expect(noBody).not.toBeNull()
    expect(noBody!.textContent).toContain('Excluir saída')
  })

  it('ao desmontar, não deixa o diálogo para trás no body', () => {
    const wrapper = mountComponent({}, { teleportReal: true })
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()

    wrapper.unmount()
    mounted.splice(mounted.indexOf(wrapper), 1)

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('confirm', () => {
  it('clicar em Confirmar emite confirmar uma vez', async () => {
    const wrapper = mountComponent()

    await confirmButton(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('confirm')![0]).toEqual([])
  })

  it('confirmar não fecha nem cancela por conta própria (quem decide é o pai)', async () => {
    const wrapper = mountComponent()

    await confirmButton(wrapper).trigger('click')

    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(dialog(wrapper).exists()).toBe(true)
  })

  it('só o clique em Confirmar dispara a ação: nada mais emite confirmar', async () => {
    const wrapper = mountComponent()

    await cancelButton(wrapper).trigger('click')
    await wrapper.setProps({ open: true })
    await closeButton(wrapper).trigger('click')
    await wrapper.setProps({ open: true })
    await dialog(wrapper).trigger('keydown', { key: 'Escape' })
    await wrapper.setProps({ open: true })
    await dialog(wrapper).element.parentElement!.click()
    await nextTick()

    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('a ação é destrutiva por padrão e pode ser não destrutiva', () => {
    const destructive = mountComponent()
    const neutro = mountComponent({ destructive: false })

    expect(confirmButton(destructive).classes()).toContain('bg-danger')
    expect(destructive.html()).toContain('bg-danger-soft')
    expect(confirmButton(neutro).classes()).toContain('bg-primary')
    expect(confirmButton(neutro).classes()).not.toContain('bg-danger')
    expect(neutro.html()).toContain('bg-warning-soft')
  })
})

describe('cancelar e fechar', () => {
  it('Cancelar fecha o diálogo e emite cancelar', async () => {
    const wrapper = mountComponent()

    await cancelButton(wrapper).trigger('click')

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(dialog(wrapper).exists()).toBe(false)
  })

  it('Esc fecha o diálogo (sem emitir confirmar)', async () => {
    const wrapper = mountComponent()

    await dialog(wrapper).trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(dialog(wrapper).exists()).toBe(false)
  })

  // Comportamento atual, registrado de propósito: só o botão Cancelar emite `cancelar`.
  // Esc, o X e o clique no fundo apenas fecham via `update:aberto`.
  it('(comportamento atual) Esc, X e clique no fundo fecham sem emitir cancelar', async () => {
    const wrapper = mountComponent()

    await dialog(wrapper).trigger('keydown', { key: 'Escape' })
    await wrapper.setProps({ open: true })
    await closeButton(wrapper).trigger('click')
    await wrapper.setProps({ open: true })
    await dialog(wrapper).element.parentElement!.click()
    await nextTick()

    expect(wrapper.emitted('update:open')).toEqual([[false], [false], [false]])
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('o botão X fecha o diálogo', async () => {
    const wrapper = mountComponent()

    await closeButton(wrapper).trigger('click')

    expect(dialog(wrapper).exists()).toBe(false)
  })

  it('clicar no fundo fecha, mas clicar dentro do painel não', async () => {
    const wrapper = mountComponent()

    await dialog(wrapper).trigger('click')
    expect(dialog(wrapper).exists()).toBe(true)

    await dialog(wrapper).element.parentElement!.click()
    await nextTick()
    expect(dialog(wrapper).exists()).toBe(false)
  })

  it('outras teclas não fecham o diálogo', async () => {
    const wrapper = mountComponent()

    await dialog(wrapper).trigger('keydown', { key: 'Enter' })
    await dialog(wrapper).trigger('keydown', { key: 'a' })

    expect(dialog(wrapper).exists()).toBe(true)
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('ao abrir, o foco vai para Cancelar (não para a ação destrutiva)', async () => {
    const wrapper = mountComponent({ open: false })

    await wrapper.setProps({ open: true })
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(cancelButton(wrapper).element)
  })
})

describe('loading', () => {
  it('desabilita Cancelar e Confirmar e marca a ação como ocupada', () => {
    const wrapper = mountComponent({ loading: true })

    expect(isDisabled(cancelButton(wrapper))).toBe(true)
    expect(isDisabled(confirmButton(wrapper))).toBe(true)
    expect(confirmButton(wrapper).attributes('aria-busy')).toBe('true')
  })

  it('sem carregando, os dois botões ficam habilitados', () => {
    const wrapper = mountComponent()

    expect(isDisabled(cancelButton(wrapper))).toBe(false)
    expect(isDisabled(confirmButton(wrapper))).toBe(false)
    expect(confirmButton(wrapper).attributes('aria-busy')).toBeUndefined()
  })

  it('não emite confirmar nem cancelar enquanto carrega', async () => {
    const wrapper = mountComponent({ loading: true })

    await confirmButton(wrapper).trigger('click')
    await cancelButton(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(dialog(wrapper).exists()).toBe(true)
  })

  it('impede confirmação dupla: depois do primeiro clique o pai marca carregando e o segundo é ignorado', async () => {
    const wrapper = mountComponent()

    await confirmButton(wrapper).trigger('click')
    await wrapper.setProps({ loading: true })
    await confirmButton(wrapper).trigger('click')
    await confirmButton(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('volta a permitir a confirmação quando o carregamento termina', async () => {
    const wrapper = mountComponent({ loading: true })

    await wrapper.setProps({ loading: false })
    await confirmButton(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
