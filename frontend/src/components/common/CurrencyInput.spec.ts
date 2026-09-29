import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CurrencyInput from '@/components/common/CurrencyInput.vue'

type Props = InstanceType<typeof CurrencyInput>['$props']

/** Monta o componente já ligado como `v-model`: o valor emitido volta como prop, como num formulário real. */
function mountComponent(props: Partial<Props> = {}, attrs: Record<string, unknown> = {}) {
  const wrapper: VueWrapper = mount(CurrencyInput, {
    props: {
      modelValue: 0,
      'onUpdate:modelValue': (amount: number) => wrapper.setProps({ modelValue: amount }),
      ...props,
    } as Props,
    attrs,
  })
  return wrapper
}

const field = (wrapper: VueWrapper) => wrapper.get('input')
const fieldValue = (wrapper: VueWrapper) => (field(wrapper).element as HTMLInputElement).value
const emittedValues = (wrapper: VueWrapper) =>
  (wrapper.emitted('update:modelValue') ?? []).map(([amount]) => amount as number)
const lastEmitted = (wrapper: VueWrapper) => emittedValues(wrapper).at(-1)

describe('exibição do valor', () => {
  it('modelo numérico aparece formatado em pt-BR', () => {
    expect(fieldValue(mountComponent({ modelValue: 1234.5 }))).toBe('1.234,50')
  })

  it('sempre com 2 casas decimais', () => {
    expect(fieldValue(mountComponent({ modelValue: 10 }))).toBe('10,00')
    expect(fieldValue(mountComponent({ modelValue: 0.5 }))).toBe('0,50')
  })

  it('modelo 0 deixa o campo vazio', () => {
    expect(fieldValue(mountComponent({ modelValue: 0 }))).toBe('')
  })

  it('sem modelo informado usa 0 e o campo fica vazio', () => {
    const wrapper = mount(CurrencyInput)

    expect(fieldValue(wrapper)).toBe('')
  })

  it('atualiza o texto quando o valor muda por fora (modo edição)', async () => {
    const wrapper = mountComponent({ modelValue: 0 })

    await wrapper.setProps({ modelValue: 99.9 })
    expect(fieldValue(wrapper)).toBe('99,90')

    await wrapper.setProps({ modelValue: 0 })
    expect(fieldValue(wrapper)).toBe('')
  })
})

describe('valor emitido ao digitar', () => {
  it.each(['1.234,56', '1234,56', '1234.56', 'R$ 1.234,56'])('"%s" emite 1234.56', async (typed) => {
    const wrapper = mountComponent()

    await field(wrapper).setValue(typed)

    expect(lastEmitted(wrapper)).toBe(1234.56)
  })

  it('emite número, nunca texto', async () => {
    const wrapper = mountComponent()

    await field(wrapper).setValue('50,5')

    expect(typeof lastEmitted(wrapper)).toBe('number')
    expect(lastEmitted(wrapper)).toBe(50.5)
  })

  it('emite a cada alteração do texto', async () => {
    const wrapper = mountComponent()

    await field(wrapper).setValue('1')
    await field(wrapper).setValue('12')
    await field(wrapper).setValue('12,5')

    expect(emittedValues(wrapper)).toEqual([1, 12, 12.5])
  })

  it('apagar o campo emite 0 (contrato atual: o modelo é sempre número, nunca null)', async () => {
    const wrapper = mountComponent({ modelValue: 1234.5 })

    await field(wrapper).setValue('')

    expect(lastEmitted(wrapper)).toBe(0)
  })

  it.each(['abc', '-', ',', '.', 'R$', '   ', '--5'])('entrada inválida %j emite um número finito', async (typed) => {
    const wrapper = mountComponent({ modelValue: 10 })

    await field(wrapper).setValue(typed)

    const emitted = lastEmitted(wrapper)
    expect(Number.isFinite(emitted)).toBe(true)
  })

  it('aceita valor negativo', async () => {
    const wrapper = mountComponent()

    await field(wrapper).setValue('-50,00')

    expect(lastEmitted(wrapper)).toBe(-50)
  })

  it('todo valor emitido é sempre um número finito', async () => {
    const wrapper = mountComponent({ modelValue: 5 })

    for (const typed of ['1.234,56', '', 'x', '9999999999,99', '0,01', '  12  ']) {
      await field(wrapper).setValue(typed)
      expect(Number.isFinite(lastEmitted(wrapper))).toBe(true)
    }
  })
})

describe('texto durante a digitação e no blur', () => {
  it('não reformata enquanto o usuário digita', async () => {
    const wrapper = mountComponent()

    await field(wrapper).setValue('1234,5')

    expect(fieldValue(wrapper)).toBe('1234,5')
  })

  it('no blur reformata o texto para 2 casas', async () => {
    const wrapper = mountComponent()
    await field(wrapper).setValue('1234,5')

    await field(wrapper).trigger('blur')

    expect(fieldValue(wrapper)).toBe('1.234,50')
  })

  it('no blur normaliza os demais formatos aceitos', async () => {
    for (const typed of ['1234.56', 'R$ 1.234,56', '1234,56']) {
      const wrapper = mountComponent()
      await field(wrapper).setValue(typed)

      await field(wrapper).trigger('blur')

      expect(fieldValue(wrapper)).toBe('1.234,56')
    }
  })

  it('no blur com texto inválido ou vazio o campo fica vazio', async () => {
    const wrapper = mountComponent({ modelValue: 10 })
    await field(wrapper).setValue('abc')

    await field(wrapper).trigger('blur')

    expect(fieldValue(wrapper)).toBe('')
  })

  it('emite blur para quem usa o componente', async () => {
    const wrapper = mountComponent()

    await field(wrapper).trigger('blur')

    expect(wrapper.emitted('blur')).toHaveLength(1)
  })

  it('o blur não altera o valor numérico emitido', async () => {
    const wrapper = mountComponent()
    await field(wrapper).setValue('1234,5')
    const before = lastEmitted(wrapper)

    await field(wrapper).trigger('blur')

    expect(lastEmitted(wrapper)).toBe(before)
  })
})

describe('campo e rótulo', () => {
  it('prefixo R$, teclado decimal, alinhamento à direita e placeholder padrão', () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('R$')
    expect(field(wrapper).attributes('inputmode')).toBe('decimal')
    expect(field(wrapper).attributes('placeholder')).toBe('0,00')
    expect(field(wrapper).classes()).toContain('text-right')
  })

  it('rótulo padrão "Valor", associado ao campo', () => {
    const wrapper = mountComponent()
    const label = wrapper.get('label')

    expect(label.text()).toContain('Valor')
    expect(label.attributes('for')).toBe(field(wrapper).attributes('id'))
  })

  it('aceita rótulo e placeholder customizados', () => {
    const wrapper = mountComponent({ label: 'Limite total', placeholder: '1.000,00' })

    expect(wrapper.get('label').text()).toContain('Limite total')
    expect(field(wrapper).attributes('placeholder')).toBe('1.000,00')
  })

  it('obrigatorio marca o campo como required', () => {
    expect(field(mountComponent({ required: true })).attributes('required')).toBeDefined()
    expect(field(mountComponent()).attributes('required')).toBeUndefined()
  })

  it('mostra a dica quando não há erro', () => {
    const wrapper = mountComponent({ hint: 'Use ponto ou vírgula' })

    expect(wrapper.text()).toContain('Use ponto ou vírgula')
  })
})

describe('erro e atributos repassados ao <input>', () => {
  it('erro marca o campo como inválido e o liga à mensagem', () => {
    const wrapper = mountComponent({ error: 'Valor deve ser maior que zero.' })
    const message = wrapper.get('[role="alert"]')

    expect(message.text()).toBe('Valor deve ser maior que zero.')
    expect(field(wrapper).attributes('aria-invalid')).toBe('true')
    expect(field(wrapper).attributes('aria-describedby')).toBe(message.attributes('id'))
  })

  it('sem erro não há aria-invalid nem mensagem', () => {
    const wrapper = mountComponent()

    expect(field(wrapper).attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('repassa id, name e data-* ao <input> nativo', () => {
    const wrapper = mountComponent({}, { id: 'campo-valor', name: 'amount', 'data-testid': 'amount' })

    expect(field(wrapper).attributes('id')).toBe('campo-valor')
    expect(field(wrapper).attributes('name')).toBe('amount')
    expect(field(wrapper).attributes('data-testid')).toBe('amount')
  })

  it('não repassa atributos ao wrapper externo', () => {
    const wrapper = mountComponent({}, { 'data-testid': 'amount' })

    expect(wrapper.attributes('data-testid')).toBeUndefined()
  })

  // Comportamento atual, registrado de propósito: `BaseInput` redefine `aria-invalid` depois do
  // `v-bind="$attrs"`, então esse atributo avulso não chega ao <input> (o estado inválido é
  // expresso pela prop `error`, teste acima). Já `disabled` tem o mesmo nome da prop do
  // `BaseInput` e chega a ele como prop, desabilitando o campo.
  it('(comportamento atual) `aria-invalid` avulso não chega ao <input>; `disabled` desabilita', () => {
    const wrapper = mountComponent({}, { disabled: true, 'aria-invalid': 'true' })

    expect(field(wrapper).attributes('disabled')).toBeDefined()
    expect(field(wrapper).attributes('aria-invalid')).toBeUndefined()
  })
})
