import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TransactionForm from '@/components/features/TransactionForm.vue'
import { useCategoryStore } from '@/stores/categoryStore'
import type { CardTransaction } from '@/types/creditCard'
import type { Expense } from '@/types/expense'
import type { Income } from '@/types/income'

const INCOME_CATEGORIES = [
  { label: 'Renda Fixa', value: 'cat_fixa' },
  { label: 'Renda Variável', value: 'cat_variavel' },
  { label: 'Investimentos', value: 'cat_invest' },
  { label: 'Outros', value: 'cat_outros' },
]

const EXPENSE_CATEGORIES = [
  { label: 'Despesa Fixa', value: 'cat_desp_fixa' },
  { label: 'Despesa Variável', value: 'cat_desp_variavel' },
  { label: 'Investimento', value: 'cat_desp_invest' },
]

beforeEach(() => {
  setActivePinia(createPinia())
  useCategoryStore().categories = [
    { id: 'cat_fixa', name: 'Renda Fixa', type: 'RENDA_FIXA', movement: 'ENTRADA', color: '#10b981' },
    { id: 'cat_variavel', name: 'Renda Variável', type: 'RENDA_VARIAVEL', movement: 'ENTRADA', color: '#06b6d4' },
    { id: 'cat_invest', name: 'Investimentos', type: 'INVESTIMENTO', movement: 'ENTRADA', color: '#eab308' },
    { id: 'cat_outros', name: 'Outros', type: 'OUTROS', movement: 'ENTRADA', color: '#94a3b8' },
    { id: 'cat_desp_fixa', name: 'Despesa Fixa', type: 'CONTA_FIXA', movement: 'SAIDA', color: '#6366f1' },
    { id: 'cat_desp_variavel', name: 'Despesa Variável', type: 'CONTA_VARIAVEL', movement: 'SAIDA', color: '#14b8a6' },
    { id: 'cat_desp_invest', name: 'Investimento', type: 'INVESTIMENTO', movement: 'SAIDA', color: '#0891b2' },
  ]
})

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

/**
 * A validação do vee-validate é assíncrona e o tempo dela varia: espera até o formulário
 * emitir `save` ou exibir um erro, em vez de contar com um atraso fixo (que dava flakiness).
 */
async function submit(wrapper: VueWrapper) {
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => {
    if (!wrapper.emitted('save') && !wrapper.find('[role="alert"]').exists()) throw new Error('validação pendente')
  })
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

const toggle = (wrapper: VueWrapper) => wrapper.get<HTMLButtonElement>('button[role="switch"]')
const isOn = (wrapper: VueWrapper) => toggle(wrapper).attributes('aria-checked') === 'true'
const isDisabled = (wrapper: VueWrapper) => toggle(wrapper).element.disabled

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'sai_1',
    description: 'Aluguel',
    amount: 1900,
    date: '2026-08-10',
    categoryId: 'cat_desp_fixa',
    type: 'CONTA',
    status: 'PENDENTE',
    dueDate: null,
    paidAt: null,
    paymentMethod: 'PIX',
    cardId: null,
    recurring: true,
    createdAt: '2026-08-10T12:00:00.000Z',
    updatedAt: '2026-08-10T12:00:00.000Z',
    ...overrides,
  }
}

describe.each([
  { kind: 'ENTRADA', context: 'default', fixed: 'cat_fixa', variable: 'cat_variavel', categories: INCOME_CATEGORIES },
  { kind: 'SAIDA', context: 'default', fixed: 'cat_desp_fixa', variable: 'cat_desp_variavel', categories: EXPENSE_CATEGORIES },
  { kind: 'SAIDA', context: 'card', fixed: 'cat_desp_fixa', variable: 'cat_desp_variavel', categories: EXPENSE_CATEGORIES },
])('recorrência por categoria — $kind/$context', ({ kind, context, fixed, variable, categories }) => {
  const mountNew = () => mountForm({ kind, context, categories })

  it('sem categoria, o toggle fica desligado e indisponível', () => {
    const wrapper = mountNew()

    expect(isOn(wrapper)).toBe(false)
    expect(isDisabled(wrapper)).toBe(true)
  })

  it('escolher a categoria fixa liga o toggle, que continua habilitado', async () => {
    const wrapper = mountNew()

    await field(wrapper, 'Categoria').setValue(fixed)

    expect(isOn(wrapper)).toBe(true)
    expect(isDisabled(wrapper)).toBe(false)
  })

  it('com categoria fixa, o usuário pode desligar', async () => {
    const wrapper = mountNew()
    await field(wrapper, 'Categoria').setValue(fixed)

    await toggle(wrapper).trigger('click')

    expect(isOn(wrapper)).toBe(false)
    expect(isDisabled(wrapper)).toBe(false)
  })

  it('trocar de fixa para não fixa desliga e desabilita; voltar para fixa religa', async () => {
    const wrapper = mountNew()
    await field(wrapper, 'Categoria').setValue(fixed)

    await field(wrapper, 'Categoria').setValue(variable)
    expect(isOn(wrapper)).toBe(false)
    expect(isDisabled(wrapper)).toBe(true)

    await field(wrapper, 'Categoria').setValue(fixed)
    expect(isOn(wrapper)).toBe(true)
    expect(isDisabled(wrapper)).toBe(false)
  })

  it('clicar no toggle desabilitado não liga a recorrência', async () => {
    const wrapper = mountNew()
    await field(wrapper, 'Categoria').setValue(variable)

    await toggle(wrapper).trigger('click')

    expect(isOn(wrapper)).toBe(false)
  })
})

describe('recorrência — demais regras', () => {
  it.each(['cat_desp_variavel', 'cat_desp_invest'])(
    'saída em categoria não fixa (%s) deixa o toggle indisponível',
    async (id) => {
      const wrapper = mountForm({ kind: 'SAIDA', categories: EXPENSE_CATEGORIES })

      await field(wrapper, 'Categoria').setValue(id)

      expect(isDisabled(wrapper)).toBe(true)
    },
  )

  it.each(['cat_variavel', 'cat_invest', 'cat_outros'])(
    'entrada em categoria não fixa (%s) deixa o toggle indisponível',
    async (id) => {
      const wrapper = mountForm({ categories: INCOME_CATEGORIES })

      await field(wrapper, 'Categoria').setValue(id)

      expect(isDisabled(wrapper)).toBe(true)
    },
  )

  it('abrir para edição mantém a recorrência já desligada de um registro fixo', () => {
    const wrapper = mountForm({
      kind: 'SAIDA',
      categories: EXPENSE_CATEGORIES,
      transaction: expense({ recurring: false }),
    })

    expect(isOn(wrapper)).toBe(false)
    expect(isDisabled(wrapper)).toBe(false)
  })

  it('editar registro recorrente trava o nome; desligar o toggle libera', async () => {
    const wrapper = mountForm({ kind: 'SAIDA', categories: EXPENSE_CATEGORIES, transaction: expense() })

    expect(field(wrapper, 'Descrição').element.disabled).toBe(true)
    expect(wrapper.text()).toContain('Desligue a recorrência para alterá-lo')

    await toggle(wrapper).trigger('click')

    expect(field(wrapper, 'Descrição').element.disabled).toBe(false)
  })

  it('salva com a recorrência desligada manualmente numa categoria fixa', async () => {
    const wrapper = mountForm({ kind: 'SAIDA', categories: EXPENSE_CATEGORIES })
    await field(wrapper, 'Descrição').setValue('Aluguel')
    await field(wrapper, 'Valor').setValue('1900')
    await field(wrapper, 'Categoria').setValue('cat_desp_fixa')
    await toggle(wrapper).trigger('click')

    await submit(wrapper)

    const [payload] = wrapper.emitted('save')![0] as [Record<string, unknown>]
    expect(payload.recurring).toBe(false)
  })

  it('cartão: categoria fixa liga a recorrência e trava o parcelamento em 1', async () => {
    const wrapper = mountForm({ kind: 'SAIDA', context: 'card', categories: EXPENSE_CATEGORIES })

    await field(wrapper, 'Categoria').setValue('cat_desp_fixa')

    expect(isOn(wrapper)).toBe(true)
    expect(field(wrapper, 'Quantidade de parcelas').element.disabled).toBe(true)
    expect(field(wrapper, 'Quantidade de parcelas').element.value).toBe('1')
  })

  it('editar um mês da série salva a data do próprio registro, não a de criação', async () => {
    const wrapper = mountForm({
      kind: 'SAIDA',
      categories: EXPENSE_CATEGORIES,
      transaction: expense({ date: '2026-11-10', createdAt: '2026-10-01T12:00:00.000Z' }),
    })

    await submit(wrapper)

    const [payload] = wrapper.emitted('save')![0] as [Record<string, unknown>]
    expect(payload.date).toBe('2026-11-10')
  })

  it('registro antigo recorrente em categoria não fixa é salvo como não recorrente', async () => {
    const transaction: CardTransaction = {
      id: 'trc_1',
      cardId: 'car_1',
      invoiceId: 'fat_1',
      description: 'Netflix',
      amount: 55,
      date: '2026-08-10',
      categoryId: 'cat_desp_variavel',
      type: 'LAZER',
      installment: 1,
      totalInstallments: 1,
      recurring: true,
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-10T12:00:00.000Z',
    }
    const wrapper = mountForm({ kind: 'SAIDA', context: 'card', categories: EXPENSE_CATEGORIES, transaction })

    expect(isOn(wrapper)).toBe(false)
    await submit(wrapper)

    const [payload] = wrapper.emitted('save')![0] as [Record<string, unknown>]
    expect(payload.recurring).toBe(false)
  })
})

describe('TransactionForm — situação da saída', () => {
  it('oferece apenas Pendente e Pago: "Vencido" nunca é selecionável', () => {
    const wrapper = mountForm({ kind: 'SAIDA', categories: EXPENSE_CATEGORIES })

    expect(optionLabels(wrapper, 'Situação')).toEqual(['Pendente', 'Pago'])
  })

  it('saída vencida aberta para edição continua com a situação gravada, Pendente', () => {
    const overdue = expense({ recurring: false, dueDate: '2020-01-10' })
    const wrapper = mountForm({ kind: 'SAIDA', categories: EXPENSE_CATEGORIES, transaction: overdue })

    expect(field(wrapper, 'Situação').element.value).toBe('PENDENTE')
    expect(optionLabels(wrapper, 'Situação')).not.toContain('Vencido')
  })
})
