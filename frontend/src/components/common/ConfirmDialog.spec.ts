import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

type Props = InstanceType<typeof ConfirmDialog>['$props']

const montados: VueWrapper[] = []

/**
 * Monta ligado como `v-model:aberto` (fechar de dentro remove o conteúdo) e preso ao documento.
 * `Teleport` vem stubado por padrão: o conteúdo fica dentro do wrapper.
 */
function montar(props: Partial<Props> = {}, { teleportReal = false } = {}) {
  const wrapper: VueWrapper = mount(ConfirmDialog, {
    props: {
      mensagem: 'Excluir esta saída?',
      aberto: true,
      'onUpdate:aberto': (valor: boolean) => wrapper.setProps({ aberto: valor }),
      ...props,
    } as Props,
    attachTo: document.body,
    global: { stubs: { teleport: !teleportReal } },
  })
  montados.push(wrapper)
  return wrapper
}

const dialogo = (wrapper: VueWrapper) => wrapper.find('[role="dialog"]')
const botao = (wrapper: VueWrapper, texto: string) => {
  const encontrado = wrapper.findAll('button').find((b) => b.text() === texto)
  expect(encontrado, `botão "${texto}" não encontrado`).toBeDefined()
  return encontrado!
}
const botaoConfirmar = (wrapper: VueWrapper) => botao(wrapper, 'Confirmar')
const botaoCancelar = (wrapper: VueWrapper) => botao(wrapper, 'Cancelar')
const botaoFechar = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Fechar"]')

const estaDesabilitado = (b: ReturnType<typeof botaoConfirmar>) => b.attributes('disabled') !== undefined

afterEach(() => {
  while (montados.length) montados.pop()!.unmount()
  document.body.style.overflow = ''
})

describe('aberto e fechado', () => {
  it('fechado não renderiza conteúdo', () => {
    const wrapper = montar({ aberto: false })

    expect(dialogo(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('aberto exibe o diálogo com título e mensagem recebidos', () => {
    const wrapper = montar({ titulo: 'Excluir saída', mensagem: 'Esta ação não pode ser desfeita.' })

    expect(dialogo(wrapper).exists()).toBe(true)
    expect(wrapper.get('h2').text()).toBe('Excluir saída')
    expect(wrapper.get('p').text()).toBe('Esta ação não pode ser desfeita.')
  })

  it('abre e fecha conforme o valor externo', async () => {
    const wrapper = montar({ aberto: false })

    await wrapper.setProps({ aberto: true })
    expect(dialogo(wrapper).exists()).toBe(true)

    await wrapper.setProps({ aberto: false })
    expect(dialogo(wrapper).exists()).toBe(false)
  })

  it('usa os textos padrão', () => {
    const wrapper = montar()

    expect(wrapper.get('h2').text()).toBe('Confirmar ação')
    expect(botaoConfirmar(wrapper).exists()).toBe(true)
    expect(botaoCancelar(wrapper).exists()).toBe(true)
  })

  it('aceita textos de confirmar e cancelar customizados', () => {
    const wrapper = montar({ textoConfirmar: 'Excluir', textoCancelar: 'Voltar' })

    expect(botao(wrapper, 'Excluir').exists()).toBe(true)
    expect(botao(wrapper, 'Voltar').exists()).toBe(true)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Confirmar')).toBe(false)
  })

  it('é um diálogo modal acessível, rotulado pelo título', () => {
    const wrapper = montar({ titulo: 'Excluir saída' })
    const modal = dialogo(wrapper)

    expect(modal.attributes('aria-modal')).toBe('true')
    expect(modal.attributes('aria-labelledby')).toBe(wrapper.get('h2').attributes('id'))
  })
})

describe('Teleport', () => {
  it('sem stub, o conteúdo vai para o document.body e não para dentro do wrapper', () => {
    const wrapper = montar({ titulo: 'Excluir saída' }, { teleportReal: true })

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    const noBody = document.body.querySelector('[role="dialog"]')
    expect(noBody).not.toBeNull()
    expect(noBody!.textContent).toContain('Excluir saída')
  })

  it('ao desmontar, não deixa o diálogo para trás no body', () => {
    const wrapper = montar({}, { teleportReal: true })
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()

    wrapper.unmount()
    montados.splice(montados.indexOf(wrapper), 1)

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('confirmar', () => {
  it('clicar em Confirmar emite confirmar uma vez', async () => {
    const wrapper = montar()

    await botaoConfirmar(wrapper).trigger('click')

    expect(wrapper.emitted('confirmar')).toHaveLength(1)
    expect(wrapper.emitted('confirmar')![0]).toEqual([])
  })

  it('confirmar não fecha nem cancela por conta própria (quem decide é o pai)', async () => {
    const wrapper = montar()

    await botaoConfirmar(wrapper).trigger('click')

    expect(wrapper.emitted('cancelar')).toBeUndefined()
    expect(wrapper.emitted('update:aberto')).toBeUndefined()
    expect(dialogo(wrapper).exists()).toBe(true)
  })

  it('só o clique em Confirmar dispara a ação: nada mais emite confirmar', async () => {
    const wrapper = montar()

    await botaoCancelar(wrapper).trigger('click')
    await wrapper.setProps({ aberto: true })
    await botaoFechar(wrapper).trigger('click')
    await wrapper.setProps({ aberto: true })
    await dialogo(wrapper).trigger('keydown', { key: 'Escape' })
    await wrapper.setProps({ aberto: true })
    await dialogo(wrapper).element.parentElement!.click()
    await nextTick()

    expect(wrapper.emitted('confirmar')).toBeUndefined()
  })

  it('a ação é destrutiva por padrão e pode ser não destrutiva', () => {
    const destrutivo = montar()
    const neutro = montar({ destrutivo: false })

    expect(botaoConfirmar(destrutivo).classes()).toContain('bg-danger')
    expect(destrutivo.html()).toContain('bg-danger-soft')
    expect(botaoConfirmar(neutro).classes()).toContain('bg-primary')
    expect(botaoConfirmar(neutro).classes()).not.toContain('bg-danger')
    expect(neutro.html()).toContain('bg-warning-soft')
  })
})

describe('cancelar e fechar', () => {
  it('Cancelar fecha o diálogo e emite cancelar', async () => {
    const wrapper = montar()

    await botaoCancelar(wrapper).trigger('click')

    expect(wrapper.emitted('update:aberto')).toEqual([[false]])
    expect(wrapper.emitted('cancelar')).toHaveLength(1)
    expect(wrapper.emitted('confirmar')).toBeUndefined()
    expect(dialogo(wrapper).exists()).toBe(false)
  })

  it('Esc fecha o diálogo (sem emitir confirmar)', async () => {
    const wrapper = montar()

    await dialogo(wrapper).trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('update:aberto')).toEqual([[false]])
    expect(wrapper.emitted('confirmar')).toBeUndefined()
    expect(dialogo(wrapper).exists()).toBe(false)
  })

  // Comportamento atual, registrado de propósito: só o botão Cancelar emite `cancelar`.
  // Esc, o X e o clique no fundo apenas fecham via `update:aberto`.
  it('(comportamento atual) Esc, X e clique no fundo fecham sem emitir cancelar', async () => {
    const wrapper = montar()

    await dialogo(wrapper).trigger('keydown', { key: 'Escape' })
    await wrapper.setProps({ aberto: true })
    await botaoFechar(wrapper).trigger('click')
    await wrapper.setProps({ aberto: true })
    await dialogo(wrapper).element.parentElement!.click()
    await nextTick()

    expect(wrapper.emitted('update:aberto')).toEqual([[false], [false], [false]])
    expect(wrapper.emitted('cancelar')).toBeUndefined()
  })

  it('o botão X fecha o diálogo', async () => {
    const wrapper = montar()

    await botaoFechar(wrapper).trigger('click')

    expect(dialogo(wrapper).exists()).toBe(false)
  })

  it('clicar no fundo fecha, mas clicar dentro do painel não', async () => {
    const wrapper = montar()

    await dialogo(wrapper).trigger('click')
    expect(dialogo(wrapper).exists()).toBe(true)

    await dialogo(wrapper).element.parentElement!.click()
    await nextTick()
    expect(dialogo(wrapper).exists()).toBe(false)
  })

  it('outras teclas não fecham o diálogo', async () => {
    const wrapper = montar()

    await dialogo(wrapper).trigger('keydown', { key: 'Enter' })
    await dialogo(wrapper).trigger('keydown', { key: 'a' })

    expect(dialogo(wrapper).exists()).toBe(true)
    expect(wrapper.emitted('update:aberto')).toBeUndefined()
  })

  it('ao abrir, o foco vai para Cancelar (não para a ação destrutiva)', async () => {
    const wrapper = montar({ aberto: false })

    await wrapper.setProps({ aberto: true })
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(botaoCancelar(wrapper).element)
  })
})

describe('carregando', () => {
  it('desabilita Cancelar e Confirmar e marca a ação como ocupada', () => {
    const wrapper = montar({ carregando: true })

    expect(estaDesabilitado(botaoCancelar(wrapper))).toBe(true)
    expect(estaDesabilitado(botaoConfirmar(wrapper))).toBe(true)
    expect(botaoConfirmar(wrapper).attributes('aria-busy')).toBe('true')
  })

  it('sem carregando, os dois botões ficam habilitados', () => {
    const wrapper = montar()

    expect(estaDesabilitado(botaoCancelar(wrapper))).toBe(false)
    expect(estaDesabilitado(botaoConfirmar(wrapper))).toBe(false)
    expect(botaoConfirmar(wrapper).attributes('aria-busy')).toBeUndefined()
  })

  it('não emite confirmar nem cancelar enquanto carrega', async () => {
    const wrapper = montar({ carregando: true })

    await botaoConfirmar(wrapper).trigger('click')
    await botaoCancelar(wrapper).trigger('click')

    expect(wrapper.emitted('confirmar')).toBeUndefined()
    expect(wrapper.emitted('cancelar')).toBeUndefined()
    expect(dialogo(wrapper).exists()).toBe(true)
  })

  it('impede confirmação dupla: depois do primeiro clique o pai marca carregando e o segundo é ignorado', async () => {
    const wrapper = montar()

    await botaoConfirmar(wrapper).trigger('click')
    await wrapper.setProps({ carregando: true })
    await botaoConfirmar(wrapper).trigger('click')
    await botaoConfirmar(wrapper).trigger('click')

    expect(wrapper.emitted('confirmar')).toHaveLength(1)
  })

  it('volta a permitir a confirmação quando o carregamento termina', async () => {
    const wrapper = montar({ carregando: true })

    await wrapper.setProps({ carregando: false })
    await botaoConfirmar(wrapper).trigger('click')

    expect(wrapper.emitted('confirmar')).toHaveLength(1)
  })
})
