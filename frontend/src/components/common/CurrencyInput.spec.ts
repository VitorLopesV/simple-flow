import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CurrencyInput from '@/components/common/CurrencyInput.vue'

type Props = InstanceType<typeof CurrencyInput>['$props']

/** Monta o componente já ligado como `v-model`: o valor emitido volta como prop, como num formulário real. */
function montar(props: Partial<Props> = {}, attrs: Record<string, unknown> = {}) {
  const wrapper: VueWrapper = mount(CurrencyInput, {
    props: {
      modelValue: 0,
      'onUpdate:modelValue': (valor: number) => wrapper.setProps({ modelValue: valor }),
      ...props,
    } as Props,
    attrs,
  })
  return wrapper
}

const campo = (wrapper: VueWrapper) => wrapper.get('input')
const valorDoCampo = (wrapper: VueWrapper) => (campo(wrapper).element as HTMLInputElement).value
const valoresEmitidos = (wrapper: VueWrapper) =>
  (wrapper.emitted('update:modelValue') ?? []).map(([valor]) => valor as number)
const ultimoEmitido = (wrapper: VueWrapper) => valoresEmitidos(wrapper).at(-1)

describe('exibição do valor', () => {
  it('modelo numérico aparece formatado em pt-BR', () => {
    expect(valorDoCampo(montar({ modelValue: 1234.5 }))).toBe('1.234,50')
  })

  it('sempre com 2 casas decimais', () => {
    expect(valorDoCampo(montar({ modelValue: 10 }))).toBe('10,00')
    expect(valorDoCampo(montar({ modelValue: 0.5 }))).toBe('0,50')
  })

  it('modelo 0 deixa o campo vazio', () => {
    expect(valorDoCampo(montar({ modelValue: 0 }))).toBe('')
  })

  it('sem modelo informado usa 0 e o campo fica vazio', () => {
    const wrapper = mount(CurrencyInput)

    expect(valorDoCampo(wrapper)).toBe('')
  })

  it('atualiza o texto quando o valor muda por fora (modo edição)', async () => {
    const wrapper = montar({ modelValue: 0 })

    await wrapper.setProps({ modelValue: 99.9 })
    expect(valorDoCampo(wrapper)).toBe('99,90')

    await wrapper.setProps({ modelValue: 0 })
    expect(valorDoCampo(wrapper)).toBe('')
  })
})

describe('valor emitido ao digitar', () => {
  it.each(['1.234,56', '1234,56', '1234.56', 'R$ 1.234,56'])('"%s" emite 1234.56', async (digitado) => {
    const wrapper = montar()

    await campo(wrapper).setValue(digitado)

    expect(ultimoEmitido(wrapper)).toBe(1234.56)
  })

  it('emite número, nunca texto', async () => {
    const wrapper = montar()

    await campo(wrapper).setValue('50,5')

    expect(typeof ultimoEmitido(wrapper)).toBe('number')
    expect(ultimoEmitido(wrapper)).toBe(50.5)
  })

  it('emite a cada alteração do texto', async () => {
    const wrapper = montar()

    await campo(wrapper).setValue('1')
    await campo(wrapper).setValue('12')
    await campo(wrapper).setValue('12,5')

    expect(valoresEmitidos(wrapper)).toEqual([1, 12, 12.5])
  })

  it('apagar o campo emite 0 (contrato atual: o modelo é sempre número, nunca null)', async () => {
    const wrapper = montar({ modelValue: 1234.5 })

    await campo(wrapper).setValue('')

    expect(ultimoEmitido(wrapper)).toBe(0)
  })

  it.each(['abc', '-', ',', '.', 'R$', '   ', '--5'])('entrada inválida %j emite um número finito', async (digitado) => {
    const wrapper = montar({ modelValue: 10 })

    await campo(wrapper).setValue(digitado)

    const emitido = ultimoEmitido(wrapper)
    expect(Number.isFinite(emitido)).toBe(true)
  })

  it('aceita valor negativo', async () => {
    const wrapper = montar()

    await campo(wrapper).setValue('-50,00')

    expect(ultimoEmitido(wrapper)).toBe(-50)
  })

  it('todo valor emitido é sempre um número finito', async () => {
    const wrapper = montar({ modelValue: 5 })

    for (const digitado of ['1.234,56', '', 'x', '9999999999,99', '0,01', '  12  ']) {
      await campo(wrapper).setValue(digitado)
      expect(Number.isFinite(ultimoEmitido(wrapper))).toBe(true)
    }
  })
})

describe('texto durante a digitação e no blur', () => {
  it('não reformata enquanto o usuário digita', async () => {
    const wrapper = montar()

    await campo(wrapper).setValue('1234,5')

    expect(valorDoCampo(wrapper)).toBe('1234,5')
  })

  it('no blur reformata o texto para 2 casas', async () => {
    const wrapper = montar()
    await campo(wrapper).setValue('1234,5')

    await campo(wrapper).trigger('blur')

    expect(valorDoCampo(wrapper)).toBe('1.234,50')
  })

  it('no blur normaliza os demais formatos aceitos', async () => {
    for (const digitado of ['1234.56', 'R$ 1.234,56', '1234,56']) {
      const wrapper = montar()
      await campo(wrapper).setValue(digitado)

      await campo(wrapper).trigger('blur')

      expect(valorDoCampo(wrapper)).toBe('1.234,56')
    }
  })

  it('no blur com texto inválido ou vazio o campo fica vazio', async () => {
    const wrapper = montar({ modelValue: 10 })
    await campo(wrapper).setValue('abc')

    await campo(wrapper).trigger('blur')

    expect(valorDoCampo(wrapper)).toBe('')
  })

  it('emite blur para quem usa o componente', async () => {
    const wrapper = montar()

    await campo(wrapper).trigger('blur')

    expect(wrapper.emitted('blur')).toHaveLength(1)
  })

  it('o blur não altera o valor numérico emitido', async () => {
    const wrapper = montar()
    await campo(wrapper).setValue('1234,5')
    const antes = ultimoEmitido(wrapper)

    await campo(wrapper).trigger('blur')

    expect(ultimoEmitido(wrapper)).toBe(antes)
  })
})

describe('campo e rótulo', () => {
  it('prefixo R$, teclado decimal, alinhamento à direita e placeholder padrão', () => {
    const wrapper = montar()

    expect(wrapper.text()).toContain('R$')
    expect(campo(wrapper).attributes('inputmode')).toBe('decimal')
    expect(campo(wrapper).attributes('placeholder')).toBe('0,00')
    expect(campo(wrapper).classes()).toContain('text-right')
  })

  it('rótulo padrão "Valor", associado ao campo', () => {
    const wrapper = montar()
    const rotulo = wrapper.get('label')

    expect(rotulo.text()).toContain('Valor')
    expect(rotulo.attributes('for')).toBe(campo(wrapper).attributes('id'))
  })

  it('aceita rótulo e placeholder customizados', () => {
    const wrapper = montar({ label: 'Limite total', placeholder: '1.000,00' })

    expect(wrapper.get('label').text()).toContain('Limite total')
    expect(campo(wrapper).attributes('placeholder')).toBe('1.000,00')
  })

  it('obrigatorio marca o campo como required', () => {
    expect(campo(montar({ obrigatorio: true })).attributes('required')).toBeDefined()
    expect(campo(montar()).attributes('required')).toBeUndefined()
  })

  it('mostra a dica quando não há erro', () => {
    const wrapper = montar({ dica: 'Use ponto ou vírgula' })

    expect(wrapper.text()).toContain('Use ponto ou vírgula')
  })
})

describe('erro e atributos repassados ao <input>', () => {
  it('erro marca o campo como inválido e o liga à mensagem', () => {
    const wrapper = montar({ erro: 'Valor deve ser maior que zero.' })
    const mensagem = wrapper.get('[role="alert"]')

    expect(mensagem.text()).toBe('Valor deve ser maior que zero.')
    expect(campo(wrapper).attributes('aria-invalid')).toBe('true')
    expect(campo(wrapper).attributes('aria-describedby')).toBe(mensagem.attributes('id'))
  })

  it('sem erro não há aria-invalid nem mensagem', () => {
    const wrapper = montar()

    expect(campo(wrapper).attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('repassa id, name e data-* ao <input> nativo', () => {
    const wrapper = montar({}, { id: 'campo-valor', name: 'valor', 'data-testid': 'valor' })

    expect(campo(wrapper).attributes('id')).toBe('campo-valor')
    expect(campo(wrapper).attributes('name')).toBe('valor')
    expect(campo(wrapper).attributes('data-testid')).toBe('valor')
  })

  it('não repassa atributos ao wrapper externo', () => {
    const wrapper = montar({}, { 'data-testid': 'valor' })

    expect(wrapper.attributes('data-testid')).toBeUndefined()
  })

  // Comportamento atual, registrado de propósito: `BaseInput` redefine `disabled` e
  // `aria-invalid` depois do `v-bind="$attrs"`, então esses dois atributos avulsos não chegam
  // ao <input>. O estado inválido é expresso pela prop `erro` (teste acima).
  it('(comportamento atual) `disabled` e `aria-invalid` avulsos não chegam ao <input>', () => {
    const wrapper = montar({}, { disabled: true, 'aria-invalid': 'true' })

    expect(campo(wrapper).attributes('disabled')).toBeUndefined()
    expect(campo(wrapper).attributes('aria-invalid')).toBeUndefined()
  })
})
