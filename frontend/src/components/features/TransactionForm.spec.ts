import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TransactionForm from '@/components/features/TransactionForm.vue'
import type { Income } from '@/types/income'

const INCOME_CATEGORIES = [
  { label: 'Renda Fixa', value: 'cat_fixa' },
  { label: 'Renda Variável', value: 'cat_variavel' },
  { label: 'Investimentos', value: 'cat_invest' },
  { label: 'Outros', value: 'cat_outros' },
]

function mountForm(props: Record<string, unknown> = {}) {
  return mount(TransactionForm, {
    props: { kind: 'ENTRADA', categories: INCOME_CATEGORIES, ...props },
  })
}

/** O `<select>` (ou `<input>`) ligado ao rótulo informado. */
function field(wrapper: VueWrapper, label: string) {
  const labelElement = wrapper.findAll('label').find((item) => item.text().startsWith(label))
  if (!labelElement) throw new Error(`Campo ausente: ${label}`)
  return wrapper.get<HTMLSelectElement>(`[id="${labelElement.attributes('for')}"]`)
}

function optionLabels(wrapper: VueWrapper, label: string): string[] {
  return field(wrapper, label)
    .findAll('option')
    .filter((option) => !option.text().startsWith('Selecione'))
    .map((option) => option.text())
}

/** A validação do vee-validate é assíncrona: espera ela terminar antes de conferir. */
async function submit(wrapper: VueWrapper) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}

describe('TransactionForm — entrada', () => {
  it('mostra Categoria com os 4 grupos e Tipo com Salário, Freelance, Rendimentos e Reembolso', () => {
    const wrapper = mountForm()

    expect(optionLabels(wrapper, 'Categoria')).toEqual([
      'Renda Fixa',
      'Renda Variável',
      'Investimentos',
      'Outros',
    ])
    expect(optionLabels(wrapper, 'Tipo')).toEqual(['Salário', 'Freelance', 'Rendimentos', 'Reembolso'])
  })

  it('não salva sem categoria nem tipo e mostra o erro nos dois campos', async () => {
    const wrapper = mountForm()
    await wrapper.get('input').setValue('Projeto X')

    await submit(wrapper)

    expect(wrapper.emitted('save')).toBeUndefined()
    const errors = wrapper.findAll('[role="alert"]').map((item) => item.text())
    expect(errors).toContain('Categoria é obrigatório.')
    expect(errors).toContain('Tipo é obrigatório.')
  })

  it('emite a categoria e o tipo escolhidos', async () => {
    const wrapper = mountForm()
    await field(wrapper, 'Descrição').setValue('Projeto X')
    await field(wrapper, 'Valor').setValue('1500')
    await field(wrapper, 'Categoria').setValue('cat_variavel')
    await field(wrapper, 'Tipo').setValue('FREELANCE')

    await submit(wrapper)

    const [payload] = wrapper.emitted('save')![0] as [Record<string, unknown>]
    expect(payload).toMatchObject({
      description: 'Projeto X',
      amount: 1500,
      categoryId: 'cat_variavel',
      type: 'FREELANCE',
    })
  })

  it('na edição, carrega a categoria e o tipo atuais da entrada', () => {
    const income: Income = {
      id: 'ent_1',
      description: 'Salário mensal',
      amount: 7000,
      date: '2026-08-05',
      categoryId: 'cat_fixa',
      type: 'SALARIO',
      recurring: false,
      createdAt: '2026-08-05T12:00:00.000Z',
      updatedAt: '2026-08-05T12:00:00.000Z',
    }
    const wrapper = mountForm({ transaction: income })

    expect(field(wrapper, 'Categoria').element.value).toBe('cat_fixa')
    expect(field(wrapper, 'Tipo').element.value).toBe('SALARIO')
  })
})
