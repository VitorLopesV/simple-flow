import { beforeEach, describe, expect, it } from 'vitest'

import {
  cards,
  withRecurrences,
  invoices,
  ensureInvoice,
  parseProjectedId,
  recalculateInvoiceTotal,
  expenses,
  expensesWithInvoices,
  cardTransactions,
} from '@/services/mock/db'
import type { CardTransaction } from '@/types/creditCard'
import type { Expense } from '@/types/expense'

interface Item {
  id: string
  date: string
  description: string
  categoryId: string
  recurring: boolean
  amount: number
  recurrenceOriginId?: string
  automatic?: boolean
  dueDate?: string | null
  status?: string
  paidAt?: string | null
}

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'sai_1',
    date: '2026-01-15',
    description: 'Aluguel',
    categoryId: 'cat_1',
    recurring: true,
    amount: 100,
    ...overrides,
  }
}

function transaction(invoiceId: string, amount: number, id: string): CardTransaction {
  return {
    id,
    cardId: cards[0]!.id,
    invoiceId,
    description: 'Compra',
    amount,
    date: '2026-08-10',
    categoryId: 'cat_1',
    type: 'OUTROS',
    installment: 1,
    totalInstallments: 1,
    recurring: false,
    notes: null,
    createdAt: '',
    updatedAt: '',
  }
}

beforeEach(() => {
  expenses.length = 0
  invoices.length = 0
  cardTransactions.length = 0
})

describe('withRecurrences', () => {
  it('projeta a ocorrência do mês seguinte a partir de uma série recorrente', () => {
    const origin = item({ dueDate: '2026-01-10' })
    const result = withRecurrences([origin], { month: 2, year: 2026 })

    expect(result).toHaveLength(2)
    const projected = result[1]!
    expect(projected.id).toBe('sai_1_2026-02')
    expect(projected.date).toBe('2026-02-15')
    expect(projected.dueDate).toBe('2026-02-10')
    expect(projected.recurrenceOriginId).toBe('sai_1')
    expect(projected.description).toBe('Aluguel')
    expect(projected.amount).toBe(100)
  })

  it('não duplica quando o mês já tem lançamento da mesma série', () => {
    const real = item({ id: 'sai_2', date: '2026-02-20', amount: 150 })
    const result = withRecurrences([item(), real], { month: 2, year: 2026 })

    expect(result).toHaveLength(2)
    expect(result.filter((i) => i.recurrenceOriginId)).toHaveLength(0)
  })

  it('projeta quando o lançamento do mês pertence a outra série', () => {
    const otherSeries = item({ id: 'sai_2', date: '2026-02-20', description: 'Internet' })
    const result = withRecurrences([item(), otherSeries], { month: 2, year: 2026 })

    expect(result.map((i) => i.id)).toContain('sai_1_2026-02')
  })

  it('não projeta para o mês da origem nem para meses anteriores', () => {
    const items = [item()]
    expect(withRecurrences(items, { month: 1, year: 2026 })).toEqual(items)
    expect(withRecurrences(items, { month: 12, year: 2025 })).toEqual(items)
  })

  it('ignora itens automáticos (faturas)', () => {
    const items = [item({ automatic: true })]
    expect(withRecurrences(items, { month: 2, year: 2026 })).toEqual(items)
  })

  it('ignora itens que já são projeção', () => {
    const items = [item({ recurrenceOriginId: 'sai_0' })]
    expect(withRecurrences(items, { month: 2, year: 2026 })).toEqual(items)
  })

  it('nunca projeta item com recorrente false', () => {
    const items = [item({ recurring: false })]
    expect(withRecurrences(items, { month: 2, year: 2026 })).toEqual(items)
  })

  it('usa a ocorrência real mais recente da série como base', () => {
    const old = item({ id: 'sai_1', date: '2026-01-05', amount: 100 })
    const recent = item({ id: 'sai_3', date: '2026-03-08', amount: 300 })
    const result = withRecurrences([old, recent], { month: 4, year: 2026 })

    const projected = result.filter((i) => i.recurrenceOriginId)
    expect(projected).toHaveLength(1)
    expect(projected[0]).toMatchObject({
      id: 'sai_3_2026-04',
      date: '2026-04-08',
      amount: 300,
      recurrenceOriginId: 'sai_3',
    })
  })

  it('limita dia 31 ao último dia do mês curto, em data e vencimento', () => {
    const origin = item({ date: '2026-01-31', dueDate: '2026-01-31' })

    const february = withRecurrences([origin], { month: 2, year: 2026 })[1]!
    expect(february.date).toBe('2026-02-28')
    expect(february.dueDate).toBe('2026-02-28')

    const april = withRecurrences([origin], { month: 4, year: 2026 })[1]!
    expect(april.date).toBe('2026-04-30')
    expect(april.dueDate).toBe('2026-04-30')

    const march = withRecurrences([origin], { month: 3, year: 2026 })[1]!
    expect(march.date).toBe('2026-03-31')
  })

  it('não cria vencimento nem status quando o item não tem (entradas)', () => {
    const projected = withRecurrences([item()], { month: 2, year: 2026 })[1]!
    expect('dueDate' in projected).toBe(false)
    expect('status' in projected).toBe(false)
  })

  it('a projeção de saída começa pendente, sem herdar o pagamento da origem', () => {
    const origin = item({ status: 'PAGO', paidAt: '2026-01-15' })
    const projected = withRecurrences([origin], { month: 2, year: 2026 })[1]!

    expect(projected.status).toBe('PENDENTE')
    expect(projected.paidAt).toBeNull()
  })

  it('não muta os dados de entrada e é determinístico', () => {
    const items = [item({ dueDate: '2026-01-10', status: 'PAGO', paidAt: '2026-01-15' })]
    const copy = structuredClone(items)

    const first = withRecurrences(items, { month: 3, year: 2026 })
    const second = withRecurrences(items, { month: 3, year: 2026 })

    expect(items).toEqual(copy)
    expect(first).toEqual(second)
    expect(first).toHaveLength(2)
  })
})

describe('parseProjectedId', () => {
  it('extrai origem e competência de um id projetado', () => {
    expect(parseProjectedId('sai_00001_2026-02')).toEqual({
      originId: 'sai_00001',
      referenceMonth: '2026-02',
    })
  })

  it.each(['sai_00001', 'sai_fat_fat_00001', ''])('devolve null para id comum %j', (id) => {
    expect(parseProjectedId(id)).toBeNull()
  })
})

describe('ensureInvoice', () => {
  it('cria fatura ABERTA com fechamento e vencimento do cartão', () => {
    const card = cards[0]!
    const invoice = ensureInvoice(card.id, '2026-08')

    expect(invoice).toMatchObject({
      cardId: card.id,
      referenceMonth: '2026-08',
      closingDate: '2026-08-20',
      dueDate: '2026-08-27',
      total: 0,
      status: 'ABERTA',
      paidAt: null,
    })
    expect(invoices).toContain(invoice)
  })

  it('reutiliza a fatura existente da competência', () => {
    const cardId = cards[0]!.id
    const first = ensureInvoice(cardId, '2026-08')
    const second = ensureInvoice(cardId, '2026-08')

    expect(second).toBe(first)
    expect(invoices).toHaveLength(1)
  })

  it('cria faturas distintas para competências e cartões distintos', () => {
    ensureInvoice(cards[0]!.id, '2026-08')
    ensureInvoice(cards[0]!.id, '2026-09')
    ensureInvoice(cards[1]!.id, '2026-08')

    expect(invoices).toHaveLength(3)
  })

  it('lança erro para cartão inexistente', () => {
    expect(() => ensureInvoice('car_inexistente', '2026-08')).toThrow('Cartão não encontrado.')
  })
})

describe('recalculateInvoiceTotal', () => {
  it('soma apenas as transações da fatura', () => {
    const invoice = ensureInvoice(cards[0]!.id, '2026-08')
    const other = ensureInvoice(cards[0]!.id, '2026-09')
    cardTransactions.push(
      transaction(invoice.id, 100, 'trc_1'),
      transaction(invoice.id, 50.5, 'trc_2'),
      transaction(other.id, 999, 'trc_3'),
    )

    recalculateInvoiceTotal(invoice.id)

    expect(invoice.total).toBe(150.5)
    expect(other.total).toBe(0)
  })

  it('zera a fatura sem transações', () => {
    const invoice = ensureInvoice(cards[0]!.id, '2026-08')
    invoice.total = 500

    recalculateInvoiceTotal(invoice.id)

    expect(invoice.total).toBe(0)
  })

  it('não lança para id inexistente', () => {
    expect(() => recalculateInvoiceTotal('fat_inexistente')).not.toThrow()
  })
})

describe('expensesWithInvoices', () => {
  it('transforma fatura com total em saída automática pendente no cartão', () => {
    const card = cards[0]!
    const invoice = ensureInvoice(card.id, '2026-08')
    invoice.total = 320

    const derived = expensesWithInvoices().find((s) => s.id === `sai_fat_${invoice.id}`)!

    expect(derived).toMatchObject({
      description: `Fatura – ${card.name}`,
      amount: 320,
      date: invoice.dueDate,
      dueDate: invoice.dueDate,
      status: 'PENDENTE',
      paidAt: null,
      paymentMethod: 'CARTAO_CREDITO',
      cardId: card.id,
      automatic: true,
    })
  })

  it('marca como PAGO quando a fatura está paga', () => {
    const invoice = ensureInvoice(cards[0]!.id, '2026-08')
    invoice.total = 320
    invoice.status = 'PAGA'
    invoice.paidAt = '2026-08-27'

    const derived = expensesWithInvoices().find((s) => s.automatic)!

    expect(derived.status).toBe('PAGO')
    expect(derived.paidAt).toBe('2026-08-27')
  })

  it('mantém fatura atrasada como pendente', () => {
    const invoice = ensureInvoice(cards[0]!.id, '2026-08')
    invoice.total = 320
    invoice.status = 'ATRASADA'

    expect(expensesWithInvoices().find((s) => s.automatic)!.status).toBe('PENDENTE')
  })

  it('omite fatura com total zero', () => {
    ensureInvoice(cards[0]!.id, '2026-08')

    expect(expensesWithInvoices()).toEqual([])
  })

  it('inclui as saídas reais antes das derivadas', () => {
    const real = { id: 'sai_real' } as Expense
    expenses.push(real)
    const invoice = ensureInvoice(cards[0]!.id, '2026-08')
    invoice.total = 10

    const result = expensesWithInvoices()

    expect(result).toHaveLength(2)
    expect(result[0]).toBe(real)
    expect(result[1]!.automatic).toBe(true)
  })
})
