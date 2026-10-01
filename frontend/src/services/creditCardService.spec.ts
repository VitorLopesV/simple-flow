import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { creditCardService } from '@/services/creditCardService'
import { EditedMonthsError } from '@/services/http'
import { mockDb } from '@/services/mock'
import type { CreditCard, CreditCardPayload, CardTransactionPayload } from '@/types/creditCard'

type Db = Awaited<ReturnType<typeof mockDb>>

const AUGUST_PERIOD = { month: 8, year: 2026 }

let db: Db

function card(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id: 'car_a',
    name: 'Alfa',
    brand: 'VISA',
    lastDigits: '1111',
    limit: 1000,
    closingDay: 20,
    dueDay: 27,
    color: '#000000',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function cardPayload(overrides: Partial<CreditCardPayload> = {}): CreditCardPayload {
  return {
    name: 'Novo',
    brand: 'MASTERCARD',
    lastDigits: '9999',
    limit: 500,
    closingDay: 10,
    dueDay: 17,
    color: '#ffffff',
    active: true,
    ...overrides,
  }
}

function transactionPayload(overrides: Partial<CardTransactionPayload> = {}): CardTransactionPayload {
  return {
    description: 'Compra',
    amount: 100,
    date: '2026-08-10',
    categoryId: 'cat_1',
    type: 'OUTROS',
    installment: 1,
    totalInstallments: 1,
    recurring: false,
    notes: null,
    ...overrides,
  }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-27T12:00:00Z'))

  db = await mockDb()
  db.cards.length = 0
  db.cards.push(
    card({ id: 'car_a', name: 'Alfa', limit: 1000 }),
    card({ id: 'car_b', name: 'Beta', limit: 0 }),
  )
  db.invoices.length = 0
  db.cardTransactions.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('list', () => {
  it('devolve ativos primeiro e depois em ordem alfabética', async () => {
    db.cards.length = 0
    db.cards.push(
      card({ id: '1', name: 'Zeta', active: true }),
      card({ id: '2', name: 'Beta', active: false }),
      card({ id: '3', name: 'Água', active: true }),
      card({ id: '4', name: 'Aaa', active: false }),
    )

    const result = await creditCardService.list()

    expect(result.map((c) => c.name)).toEqual(['Água', 'Zeta', 'Aaa', 'Beta'])
  })

  it('devolve cópias e não reordena o banco', async () => {
    db.cards.length = 0
    db.cards.push(card({ id: '1', name: 'Zeta' }), card({ id: '2', name: 'Alfa' }))

    const result = await creditCardService.list()
    result[0]!.name = 'Alterado'

    expect(db.cards.map((c) => c.name)).toEqual(['Zeta', 'Alfa'])
  })
})

describe('listWithInvoices', () => {
  it('combina cartão e fatura da competência, com uso do limite em percentual', async () => {
    await creditCardService.createTransaction('car_a', transactionPayload({ amount: 100 }))
    await creditCardService.createTransaction('car_a', transactionPayload({ amount: 150 }))

    const result = await creditCardService.listWithInvoices({ period: AUGUST_PERIOD })
    const alfa = result.find((r) => r.card.id === 'car_a')!

    expect(alfa.invoice).not.toBeNull()
    expect(alfa.invoice!.referenceMonth).toBe('2026-08')
    expect(alfa.invoice!.total).toBe(250)
    expect(alfa.invoice!.transactions).toHaveLength(2)
    expect(alfa.limitUsage).toBe(25)
  })

  it('devolve fatura null e uso 0 quando o cartão não tem fatura na competência', async () => {
    await creditCardService.createTransaction('car_a', transactionPayload({ date: '2026-07-10' }))

    const result = await creditCardService.listWithInvoices({ period: AUGUST_PERIOD })
    const alfa = result.find((r) => r.card.id === 'car_a')!

    expect(alfa.invoice).toBeNull()
    expect(alfa.limitUsage).toBe(0)
  })

  it('limitUsage é 0 quando o limite do cartão é 0', async () => {
    await creditCardService.createTransaction('car_b', transactionPayload({ amount: 300 }))

    const result = await creditCardService.listWithInvoices({ period: AUGUST_PERIOD })
    const beta = result.find((r) => r.card.id === 'car_b')!

    expect(beta.invoice!.total).toBe(300)
    expect(beta.limitUsage).toBe(0)
  })

  it('filtra por cardId', async () => {
    const result = await creditCardService.listWithInvoices({ period: AUGUST_PERIOD, cardId: 'car_b' })

    expect(result.map((r) => r.card.id)).toEqual(['car_b'])
  })

  it('ordena as transações da fatura por data decrescente', async () => {
    await creditCardService.createTransaction('car_a', transactionPayload({ description: 'meio', date: '2026-08-10' }))
    await creditCardService.createTransaction('car_a', transactionPayload({ description: 'created', date: '2026-08-25' }))
    await creditCardService.createTransaction('car_a', transactionPayload({ description: 'velha', date: '2026-08-01' }))

    const [alfa] = await creditCardService.listWithInvoices({ period: AUGUST_PERIOD, cardId: 'car_a' })

    expect(alfa!.invoice!.transactions.map((t) => t.description)).toEqual(['created', 'meio', 'velha'])
  })

  it('ordena cartões ativos primeiro e depois alfabeticamente', async () => {
    db.cards.length = 0
    db.cards.push(
      card({ id: '1', name: 'Zeta', active: true }),
      card({ id: '2', name: 'Aaa', active: false }),
      card({ id: '3', name: 'Alfa', active: true }),
    )

    const result = await creditCardService.listWithInvoices({ period: AUGUST_PERIOD })

    expect(result.map((r) => r.card.name)).toEqual(['Alfa', 'Zeta', 'Aaa'])
  })

  it('devolve cópias: alterar o resultado não muda o banco', async () => {
    await creditCardService.createTransaction('car_a', transactionPayload({ amount: 100 }))

    const [alfa] = await creditCardService.listWithInvoices({ period: AUGUST_PERIOD, cardId: 'car_a' })
    alfa!.invoice!.total = 999
    alfa!.card.name = 'Alterado'

    expect(db.invoices[0]!.total).toBe(100)
    expect(db.cards[0]!.name).toBe('Alfa')
  })
})

describe('create / update', () => {
  it('criar gera id e createdAt e persiste', async () => {
    const created = await creditCardService.create(cardPayload({ name: 'Gama' }))

    expect(created.id).toMatch(/^car_\d+$/)
    expect(created.createdAt).toBe('2026-08-27T12:00:00.000Z')
    expect(created.name).toBe('Gama')
    expect(db.cards).toHaveLength(3)
    expect(db.cards[2]).toEqual(created)
    expect(db.cards[2]).not.toBe(created)
  })

  it('atualizar aplica o payload preservando id e createdAt', async () => {
    const updated = await creditCardService.update('car_a', cardPayload({ name: 'Renomeado', limit: 42 }))

    expect(updated.id).toBe('car_a')
    expect(updated.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(updated.name).toBe('Renomeado')
    expect(updated.limit).toBe(42)
    expect(db.cards[0]).toEqual(updated)
  })

  it('atualizar cartão inexistente rejeita com "Cartão não encontrado."', async () => {
    await expect(creditCardService.update('car_x', cardPayload())).rejects.toThrow('Cartão não encontrado.')
  })
})

describe('remove', () => {
  it('exclui o cartão, suas faturas e suas transações, sem deixar órfãs', async () => {
    await creditCardService.createTransaction('car_a', transactionPayload({ date: '2026-08-10' }))
    await creditCardService.createTransaction('car_a', transactionPayload({ date: '2026-09-10' }))
    await creditCardService.createTransaction('car_b', transactionPayload({ date: '2026-08-10', amount: 70 }))

    await creditCardService.remove('car_a')

    expect(db.cards.map((c) => c.id)).toEqual(['car_b'])
    expect(db.invoices.map((f) => f.cardId)).toEqual(['car_b'])
    expect(db.cardTransactions.map((t) => t.cardId)).toEqual(['car_b'])
    expect(db.cardTransactions[0]!.amount).toBe(70)
  })

  it('cartão inexistente rejeita com "Cartão não encontrado."', async () => {
    await expect(creditCardService.remove('car_x')).rejects.toThrow('Cartão não encontrado.')
  })
})

describe('createTransaction', () => {
  it('cria a fatura ABERTA da competência da data e vincula a transação', async () => {
    const transaction = await creditCardService.createTransaction('car_a', transactionPayload({ date: '2026-09-15', amount: 80 }))

    expect(db.invoices).toHaveLength(1)
    const invoice = db.invoices[0]!
    expect(invoice).toMatchObject({
      cardId: 'car_a',
      referenceMonth: '2026-09',
      closingDate: '2026-09-20',
      dueDate: '2026-09-27',
      status: 'ABERTA',
      paidAt: null,
    })
    expect(transaction.invoiceId).toBe(invoice.id)
    expect(transaction.cardId).toBe('car_a')
    expect(transaction.id).toMatch(/^trc_\d+$/)
    expect(invoice.total).toBe(80)
  })

  it('reutiliza a fatura existente e soma o total', async () => {
    await creditCardService.createTransaction('car_a', transactionPayload({ amount: 80, date: '2026-08-01' }))
    await creditCardService.createTransaction('car_a', transactionPayload({ amount: 20.5, date: '2026-08-28' }))

    expect(db.invoices).toHaveLength(1)
    expect(db.invoices[0]!.total).toBe(100.5)
    expect(db.cardTransactions).toHaveLength(2)
  })

  it('cartão inexistente rejeita com "Cartão não encontrado." sem criar nada', async () => {
    await expect(creditCardService.createTransaction('car_x', transactionPayload())).rejects.toThrow('Cartão não encontrado.')

    expect(db.invoices).toHaveLength(0)
    expect(db.cardTransactions).toHaveLength(0)
  })
})

describe('updateTransaction', () => {
  it('mudar a data para outra competência move a transação e recalcula os dois totais', async () => {
    const moved = await creditCardService.createTransaction('car_a', transactionPayload({ amount: 100, date: '2026-08-10' }))
    await creditCardService.createTransaction('car_a', transactionPayload({ amount: 50, date: '2026-08-12' }))
    const augustInvoice = db.invoices.find((f) => f.referenceMonth === '2026-08')!
    expect(augustInvoice.total).toBe(150)

    const updated = await creditCardService.updateTransaction(
      'car_a',
      moved.id,
      transactionPayload({ amount: 100, date: '2026-09-05' }),
    )

    const septemberInvoice = db.invoices.find((f) => f.referenceMonth === '2026-09')!
    expect(updated.invoiceId).toBe(septemberInvoice.id)
    expect(augustInvoice.total).toBe(50)
    expect(septemberInvoice.total).toBe(100)
    expect(db.invoices).toHaveLength(2)
  })

  it('mover para uma fatura já existente soma nela e tira da anterior', async () => {
    const moved = await creditCardService.createTransaction('car_a', transactionPayload({ amount: 100, date: '2026-08-10' }))
    await creditCardService.createTransaction('car_a', transactionPayload({ amount: 40, date: '2026-09-10' }))

    await creditCardService.updateTransaction('car_a', moved.id, transactionPayload({ amount: 100, date: '2026-09-20' }))

    expect(db.invoices.find((f) => f.referenceMonth === '2026-08')!.total).toBe(0)
    expect(db.invoices.find((f) => f.referenceMonth === '2026-09')!.total).toBe(140)
  })

  it('mesma competência recalcula o total sem contar em dobro', async () => {
    const transaction = await creditCardService.createTransaction('car_a', transactionPayload({ amount: 100, date: '2026-08-10' }))
    await creditCardService.createTransaction('car_a', transactionPayload({ amount: 50, date: '2026-08-12' }))

    const updated = await creditCardService.updateTransaction(
      'car_a',
      transaction.id,
      transactionPayload({ amount: 300, date: '2026-08-15', description: 'Editada' }),
    )

    expect(db.invoices).toHaveLength(1)
    expect(db.invoices[0]!.total).toBe(350)
    expect(updated.invoiceId).toBe(db.invoices[0]!.id)
    expect(updated.description).toBe('Editada')
    expect(updated.id).toBe(transaction.id)
    expect(updated.createdAt).toBe(transaction.createdAt)
  })

  it('transação inexistente rejeita com "Transação não encontrada."', async () => {
    await expect(creditCardService.updateTransaction('car_a', 'trc_x', transactionPayload())).rejects.toThrow(
      'Transação não encontrada.',
    )
  })
})

describe('removeTransaction', () => {
  it('remove a transação e recalcula o total da fatura', async () => {
    const first = await creditCardService.createTransaction('car_a', transactionPayload({ amount: 100 }))
    await creditCardService.createTransaction('car_a', transactionPayload({ amount: 50 }))

    await creditCardService.removeTransaction('car_a', first.id)

    expect(db.cardTransactions).toHaveLength(1)
    expect(db.invoices[0]!.total).toBe(50)
  })

  it('remover a última transação zera o total', async () => {
    const single = await creditCardService.createTransaction('car_a', transactionPayload({ amount: 100 }))

    await creditCardService.removeTransaction('car_a', single.id)

    expect(db.invoices[0]!.total).toBe(0)
  })

  it('transação inexistente rejeita com "Transação não encontrada."', async () => {
    await expect(creditCardService.removeTransaction('car_a', 'trc_x')).rejects.toThrow('Transação não encontrada.')
  })
})

describe('payInvoice', () => {
  it('marca como PAGA com paidAt de hoje', async () => {
    await creditCardService.createTransaction('car_a', transactionPayload({ date: '2026-08-10' }))
    await creditCardService.createTransaction('car_a', transactionPayload({ date: '2026-09-10' }))
    const [august, september] = db.invoices

    await creditCardService.payInvoice(august!.id)

    expect(august!.status).toBe('PAGA')
    expect(august!.paidAt).toBe('2026-08-27')
    expect(september!.status).toBe('ABERTA')
    expect(september!.paidAt).toBeNull()
  })

  it('fatura inexistente rejeita com "Fatura não encontrada."', async () => {
    await expect(creditCardService.payInvoice('fat_x')).rejects.toThrow('Fatura não encontrada.')
  })
})

describe('transação recorrente (mock)', () => {
  const fixedCategory = () => db.categories.find((category) => category.name === 'Despesa Fixa')!.id
  const variableCategory = () => db.categories.find((category) => category.name === 'Despesa Variável')!.id
  const invoiceOf = (referenceMonth: string) =>
    db.invoices.find((invoice) => invoice.cardId === 'car_a' && invoice.referenceMonth === referenceMonth)

  it('Despesa Fixa recorrente entra na fatura do mês e na do mês seguinte', async () => {
    const created = await creditCardService.createTransaction(
      'car_a',
      transactionPayload({ description: 'Netflix', amount: 55, categoryId: fixedCategory(), recurring: true }),
    )

    expect(db.cardTransactions).toHaveLength(2)
    expect(invoiceOf('2026-08')!.total).toBe(55)
    expect(invoiceOf('2026-09')!.total).toBe(55)
    expect(db.cardTransactions[1]).toMatchObject({ date: '2026-09-10', seriesId: created.seriesId })
  })

  it('recorrente em categoria não fixa é recusada', async () => {
    await expect(
      creditCardService.createTransaction(
        'car_a',
        transactionPayload({ categoryId: variableCategory(), recurring: true }),
      ),
    ).rejects.toThrow('Lançamento recorrente só é permitido em Renda Fixa ou Despesa Fixa.')
  })

  it('excluir um mês remove ele e os seguintes e recalcula as faturas', async () => {
    const created = await creditCardService.createTransaction(
      'car_a',
      transactionPayload({ amount: 55, categoryId: fixedCategory(), recurring: true }),
    )

    await creditCardService.removeTransaction('car_a', created.id)

    expect(db.cardTransactions).toHaveLength(0)
    expect(invoiceOf('2026-08')!.total).toBe(0)
    expect(invoiceOf('2026-09')!.total).toBe(0)
  })

  it('desligar a recorrência mantém o mês e remove os seguintes', async () => {
    const created = await creditCardService.createTransaction(
      'car_a',
      transactionPayload({ amount: 55, categoryId: fixedCategory(), recurring: true }),
    )

    await creditCardService.updateTransaction(
      'car_a',
      created.id,
      transactionPayload({ amount: 55, categoryId: fixedCategory(), recurring: false }),
    )

    expect(db.cardTransactions.map((item) => item.id)).toEqual([created.id])
    expect(invoiceOf('2026-08')!.total).toBe(55)
    expect(invoiceOf('2026-09')!.total).toBe(0)
  })

  it('a recorrência do cartão aparece como fatura em Saídas no mês seguinte', async () => {
    await creditCardService.createTransaction(
      'car_a',
      transactionPayload({ amount: 55, categoryId: fixedCategory(), recurring: true }),
    )

    const september = db
      .expensesWithInvoices()
      .filter((expense) => expense.automatic && expense.date.startsWith('2026-09'))

    expect(september.map((expense) => expense.amount)).toEqual([55])
  })
})

describe('transação recorrente com mês seguinte alterado (mock)', () => {
  const fixedCategory = () => db.categories.find((category) => category.name === 'Despesa Fixa')!.id

  it('excluir pede confirmação; confirmado, remove os dois meses', async () => {
    const created = await creditCardService.createTransaction(
      'car_a',
      transactionPayload({ amount: 55, categoryId: fixedCategory(), recurring: true }),
    )
    const september = db.cardTransactions.find((item) => item.id !== created.id)!
    await creditCardService.updateTransaction(
      'car_a',
      september.id,
      transactionPayload({ date: september.date, amount: 60, categoryId: fixedCategory(), recurring: true }),
    )

    const error = await creditCardService.removeTransaction('car_a', created.id).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EditedMonthsError)
    expect((error as EditedMonthsError).months).toEqual(['2026-09'])
    expect(db.cardTransactions).toHaveLength(2)

    await creditCardService.removeTransaction('car_a', created.id, { confirm: true })
    expect(db.cardTransactions).toHaveLength(0)
  })
})
