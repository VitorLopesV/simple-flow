import { beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { EditedMonthsError, USE_MOCK } from '@/services/http'
import { mockDb } from '@/services/mock'
import { compareExpensesByDueDate, expenseService } from '@/services/expenseService'
import type { Expense, ExpenseFilter, ExpensePayload } from '@/types/expense'

type Db = Awaited<ReturnType<typeof mockDb>>

let db: Db
let categoryA: string
let categoryB: string

let sequence = 0

function expense(overrides: Partial<Expense> = {}): Expense {
  sequence += 1
  return {
    id: `sai_teste_${sequence}`,
    description: 'Conta',
    amount: 100,
    date: '2026-08-10',
    categoryId: categoryA,
    type: 'CONTA',
    status: 'PENDENTE',
    dueDate: null,
    paidAt: null,
    paymentMethod: 'PIX',
    cardId: null,
    recurring: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function payload(overrides: Partial<ExpensePayload> = {}): ExpensePayload {
  return {
    description: 'Conta',
    amount: 100,
    date: '2026-08-10',
    categoryId: categoryA,
    type: 'CONTA',
    status: 'PENDENTE',
    dueDate: null,
    paidAt: null,
    paymentMethod: 'PIX',
    cardId: null,
    recurring: false,
    ...overrides,
  }
}

function filter(overrides: Partial<ExpenseFilter> = {}): ExpenseFilter {
  return { period: { month: 8, year: 2026 }, page: 1, pageSize: 50, ...overrides }
}

beforeEach(async () => {
  db = await mockDb()
  db.expenses.length = 0
  db.invoices.length = 0
  db.cardTransactions.length = 0
  categoryA = db.categories[0]!.id
  categoryB = db.categories[1]!.id
})

it('roda no modo mock, sem chamadas de rede', () => {
  expect(USE_MOCK).toBe(true)
})

describe('compareExpensesByDueDate', () => {
  it('com ambas com vencimento, o mais próximo vem primeiro', () => {
    const early = expense({ dueDate: '2026-08-05' })
    const late = expense({ dueDate: '2026-08-10' })

    expect(compareExpensesByDueDate(early, late)).toBeLessThan(0)
    expect(compareExpensesByDueDate(late, early)).toBeGreaterThan(0)
    expect(compareExpensesByDueDate(early, { ...early })).toBe(0)
  })

  it('com só uma com vencimento, ela vem primeiro', () => {
    const withDueDate = expense({ dueDate: '2026-08-30' })
    const withoutDueDate = expense({ dueDate: null, date: '2026-08-01' })

    expect(compareExpensesByDueDate(withDueDate, withoutDueDate)).toBe(-1)
    expect(compareExpensesByDueDate(withoutDueDate, withDueDate)).toBe(1)
  })

  it('sem vencimento em nenhuma, a data mais recente vem primeiro', () => {
    const old = expense({ date: '2026-08-01' })
    const recent = expense({ date: '2026-08-20' })

    expect(compareExpensesByDueDate(old, recent)).toBeGreaterThan(0)
    expect(compareExpensesByDueDate(recent, old)).toBeLessThan(0)
  })

  it('ordena uma lista mista com todas as regras', () => {
    const withoutDueDateOld = expense({ id: 'sem_antiga', date: '2026-08-01' })
    const withoutDueDateRecent = expense({ id: 'sem_recente', date: '2026-08-20' })
    const dueLate = expense({ id: 'tarde', dueDate: '2026-08-25' })
    const dueEarly = expense({ id: 'cedo', dueDate: '2026-08-03' })

    const sorted = [withoutDueDateOld, dueLate, withoutDueDateRecent, dueEarly].sort(compareExpensesByDueDate)

    expect(sorted.map((s) => s.id)).toEqual(['cedo', 'tarde', 'sem_recente', 'sem_antiga'])
  })
})

describe('list', () => {
  it('filtra pelo período', async () => {
    db.expenses.push(
      expense({ id: 'ago', date: '2026-08-10' }),
      expense({ id: 'set', date: '2026-09-10' }),
      expense({ id: 'jul', date: '2026-07-31' }),
    )

    const { items } = await expenseService.list(filter())

    expect(items.map((s) => s.id)).toEqual(['ago'])
  })

  it('filtra por categoria', async () => {
    db.expenses.push(
      expense({ id: 'a', categoryId: categoryA }),
      expense({ id: 'b', categoryId: categoryB }),
    )

    const { items } = await expenseService.list(filter({ categoryId: categoryB }))

    expect(items.map((s) => s.id)).toEqual(['b'])
  })

  it('filtra por status', async () => {
    db.expenses.push(
      expense({ id: 'pending', status: 'PENDENTE' }),
      expense({ id: 'pago', status: 'PAGO', paidAt: '2026-08-10' }),
    )

    const paid = await expenseService.list(filter({ status: 'PAGO' }))
    const pendentes = await expenseService.list(filter({ status: 'PENDENTE' }))

    expect(paid.items.map((s) => s.id)).toEqual(['pago'])
    expect(pendentes.items.map((s) => s.id)).toEqual(['pending'])
  })

  it('busca sem diferenciar acento nem caixa, considerando a observação', async () => {
    db.expenses.push(
      expense({ id: 'cafe', description: 'Café da manhã' }),
      expense({ id: 'obs', description: 'Compra', notes: 'No MERCADO central' }),
      expense({ id: 'other', description: 'Aluguel' }),
    )

    const byDescription = await expenseService.list(filter({ search: 'CAFE' }))
    const byNotes = await expenseService.list(filter({ search: 'mercado' }))

    expect(byDescription.items.map((s) => s.id)).toEqual(['cafe'])
    expect(byNotes.items.map((s) => s.id)).toEqual(['obs'])
  })

  it('inclui a fatura de cartão do período como saída automática', async () => {
    const card = db.cards[0]!
    const invoice = db.ensureInvoice(card.id, '2026-08')
    invoice.total = 450

    const { items } = await expenseService.list(filter())

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: `sai_fat_${invoice.id}`,
      amount: 450,
      automatic: true,
      paymentMethod: 'CARTAO_CREDITO',
    })
  })

  it('pagina e informa total e totalPages', async () => {
    for (let day = 1; day <= 5; day += 1) {
      db.expenses.push(expense({ id: `s${day}`, date: `2026-08-0${day}` }))
    }

    const first = await expenseService.list(filter({ page: 1, pageSize: 2 }))
    const last = await expenseService.list(filter({ page: 3, pageSize: 2 }))

    expect(first.items).toHaveLength(2)
    expect(first.total).toBe(5)
    expect(first.totalPages).toBe(3)
    expect(last.items).toHaveLength(1)
    expect(last.page).toBe(3)
  })

  it('ordena por vencimento antes das sem vencimento', async () => {
    db.expenses.push(
      expense({ id: 'sem', date: '2026-08-28' }),
      expense({ id: 'tarde', dueDate: '2026-08-25' }),
      expense({ id: 'cedo', dueDate: '2026-08-03' }),
    )

    const { items } = await expenseService.list(filter())

    expect(items.map((s) => s.id)).toEqual(['cedo', 'tarde', 'sem'])
  })

  it('devolve cópias: alterar o resultado não muda o banco', async () => {
    db.expenses.push(expense({ id: 'a', description: 'Original' }))

    const { items } = await expenseService.list(filter())
    items[0]!.description = 'Alterada'

    expect(db.expenses[0]!.description).toBe('Original')
  })
})

describe('summary', () => {
  it('calcula totais, média, pago/pendente e mês anterior', async () => {
    db.expenses.push(
      expense({ amount: 100, status: 'PAGO', paidAt: '2026-08-02', categoryId: categoryA }),
      expense({ amount: 50, status: 'PENDENTE', categoryId: categoryA }),
      expense({ amount: 250, status: 'PAGO', paidAt: '2026-08-03', categoryId: categoryB }),
      expense({ amount: 70, date: '2026-07-15', categoryId: categoryA }),
      expense({ amount: 999, date: '2026-09-15', categoryId: categoryA }),
    )

    const summary = await expenseService.summary({ month: 8, year: 2026 })

    expect(summary.total).toBe(400)
    expect(summary.count).toBe(3)
    expect(summary.average).toBeCloseTo(400 / 3)
    expect(summary.paidTotal).toBe(350)
    expect(summary.pendingTotal).toBe(50)
    expect(summary.previousMonthTotal).toBe(70)
  })

  it('ordena byCategory do maior para o menor, com nome e cor da categoria', async () => {
    db.expenses.push(
      expense({ amount: 100, categoryId: categoryA }),
      expense({ amount: 50, categoryId: categoryA }),
      expense({ amount: 250, categoryId: categoryB }),
    )

    const { byCategory } = await expenseService.summary({ month: 8, year: 2026 })

    const catA = db.categories.find((c) => c.id === categoryA)!
    const catB = db.categories.find((c) => c.id === categoryB)!
    expect(byCategory).toEqual([
      { categoryId: categoryB, name: catB.name, color: catB.color, total: 250 },
      { categoryId: categoryA, name: catA.name, color: catA.color, total: 150 },
    ])
  })

  it('usa "Sem categoria" e cor neutra para categoria desconhecida', async () => {
    db.expenses.push(expense({ amount: 40, categoryId: 'cat_inexistente' }))

    const { byCategory } = await expenseService.summary({ month: 8, year: 2026 })

    expect(byCategory).toEqual([
      { categoryId: 'cat_inexistente', name: 'Sem categoria', color: '#94a3b8', total: 40 },
    ])
  })

  it('agrupa por tipo, ordena por total e ignora outros meses', async () => {
    db.expenses.push(
      expense({ amount: 30, type: 'LAZER' }),
      expense({ amount: 20, type: 'LAZER' }),
      expense({ amount: 90, type: 'TRANSPORTE' }),
      expense({ amount: 500, type: 'CONTA', date: '2026-07-10' }),
    )

    const summary = await expenseService.summary({ month: 8, year: 2026 })

    expect(summary.byType).toEqual([
      { type: 'TRANSPORTE', total: 90 },
      { type: 'LAZER', total: 50 },
    ])
  })

  it('devolve zeros e média 0 sem itens', async () => {
    const summary = await expenseService.summary({ month: 8, year: 2026 })

    expect(summary).toEqual({
      total: 0,
      count: 0,
      average: 0,
      paidTotal: 0,
      pendingTotal: 0,
      previousMonthTotal: 0,
      byCategory: [],
      byType: [],
    })
  })
})

describe('create', () => {
  it('PAGO define paidAt como hoje, ignorando o valor do payload', async () => {
    const created = await expenseService.create(payload({ status: 'PAGO', paidAt: '1999-01-01' }))

    expect(created.paidAt).toBe(db.todayISO)
  })

  it('PENDENTE define paidAt como null, ignorando o valor do payload', async () => {
    const created = await expenseService.create(payload({ status: 'PENDENTE', paidAt: '1999-01-01' }))

    expect(created.paidAt).toBeNull()
  })

  it('gera id e datas de auditoria e persiste no banco', async () => {
    const created = await expenseService.create(payload({ description: 'Nova' }))

    expect(created.id).toMatch(/^sai_\d+$/)
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false)
    expect(Number.isNaN(Date.parse(created.updatedAt))).toBe(false)
    expect(created.description).toBe('Nova')
    expect(db.expenses).toHaveLength(1)
    expect(db.expenses[0]).toEqual(created)
    expect(db.expenses[0]).not.toBe(created)
  })
})

describe('update', () => {
  it('pendente → paga carimba hoje', async () => {
    db.expenses.push(expense({ id: 'x', status: 'PENDENTE' }))

    const updated = await expenseService.update('x', payload({ status: 'PAGO' }))

    expect(updated.paidAt).toBe(db.todayISO)
  })

  it('já paga mantém a data de pagamento original', async () => {
    db.expenses.push(expense({ id: 'x', status: 'PAGO', paidAt: '2026-08-01' }))

    const updated = await expenseService.update('x', payload({ status: 'PAGO', paidAt: '2030-01-01' }))

    expect(updated.paidAt).toBe('2026-08-01')
  })

  it('paga → pendente limpa paidAt', async () => {
    db.expenses.push(expense({ id: 'x', status: 'PAGO', paidAt: '2026-08-01' }))

    const updated = await expenseService.update('x', payload({ status: 'PENDENTE' }))

    expect(updated.paidAt).toBeNull()
  })

  it('atualiza o registro no banco preservando id e createdAt', async () => {
    db.expenses.push(expense({ id: 'x', amount: 10 }))

    const updated = await expenseService.update('x', payload({ amount: 99 }))

    expect(updated.id).toBe('x')
    expect(updated.amount).toBe(99)
    expect(updated.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(updated.updatedAt).not.toBe('2026-01-01T00:00:00.000Z')
    expect(db.expenses).toHaveLength(1)
    expect(db.expenses[0]!.amount).toBe(99)
  })

  it('saída recorrente mantém a descrição original enquanto continuar recorrente', async () => {
    db.expenses.push(expense({ id: 'x', description: 'Aluguel', recurring: true }))

    const updated = await expenseService.update(
      'x',
      payload({ description: 'Outro nome', recurring: true }),
    )

    expect(updated.description).toBe('Aluguel')
  })

  it('ao deixar de ser recorrente, aceita a nova descrição', async () => {
    db.expenses.push(expense({ id: 'x', description: 'Aluguel', recurring: true }))

    const updated = await expenseService.update(
      'x',
      payload({ description: 'Outro nome', recurring: false }),
    )

    expect(updated.description).toBe('Outro nome')
  })

  it('id inexistente rejeita com "Saída não encontrada."', async () => {
    await expect(expenseService.update('sai_nao_existe', payload())).rejects.toThrow(
      'Saída não encontrada.',
    )
  })
})

describe('remove', () => {
  it('remove a saída e ela deixa de ser listada', async () => {
    db.expenses.push(expense({ id: 'a' }), expense({ id: 'b' }))

    await expenseService.remove('a')
    const { items } = await expenseService.list(filter())

    expect(items.map((s) => s.id)).toEqual(['b'])
    expect(db.expenses).toHaveLength(1)
  })

  it('id inexistente rejeita com "Saída não encontrada."', async () => {
    await expect(expenseService.remove('sai_nao_existe')).rejects.toThrow('Saída não encontrada.')
  })
})

describe('recorrência com registros reais (mock)', () => {
  /** categoryA = Despesa Fixa, categoryB = Despesa Variável (ordem da semente). */
  function seriesMonths(seriesId: string | null | undefined) {
    return db.expenses
      .filter((item) => item.seriesId === seriesId)
      .map((item) => item.date)
      .sort()
  }

  it('criar recorrente em Despesa Fixa cria também o mês seguinte, PENDENTE e na mesma série', async () => {
    const created = await expenseService.create(
      payload({ description: 'Aluguel', date: '2026-08-10', status: 'PAGO', recurring: true }),
    )

    expect(created.seriesId).toBeTruthy()
    expect(db.expenses).toHaveLength(2)
    expect(db.expenses[1]).toMatchObject({
      description: 'Aluguel',
      date: '2026-09-10',
      status: 'PENDENTE',
      paidAt: null,
      seriesId: created.seriesId,
    })

    const september = await expenseService.list(filter({ period: { month: 9, year: 2026 } }))
    expect(september.items.map((item) => item.description)).toEqual(['Aluguel'])
    expect(september.items[0]!.id).not.toContain('_2026-')
  })

  it('recorrente em categoria não fixa é recusado', async () => {
    await expect(
      expenseService.create(payload({ categoryId: categoryB, recurring: true })),
    ).rejects.toThrow('Lançamento recorrente só é permitido em Renda Fixa ou Despesa Fixa.')
    expect(db.expenses).toHaveLength(0)
  })

  it('não recorrente não cria o mês seguinte', async () => {
    await expenseService.create(payload({ recurring: false }))

    expect(db.expenses).toHaveLength(1)
    expect(db.expenses[0]!.seriesId).toBeNull()
  })

  it('excluir um mês remove ele e os seguintes da série; anteriores ficam intactos', async () => {
    db.expenses.push(
      expense({ id: 'jul', date: '2026-07-10', recurring: true, seriesId: 's' }),
      expense({ id: 'ago', date: '2026-08-10', recurring: true, seriesId: 's' }),
      expense({ id: 'set', date: '2026-09-10', recurring: true, seriesId: 's' }),
      expense({ id: 'out', date: '2026-10-10', recurring: true, seriesId: 's' }),
      expense({ id: 'outra', date: '2026-10-10', recurring: true, seriesId: 'outra' }),
    )

    await expenseService.remove('set')

    expect(db.expenses.map((item) => item.id)).toEqual(['jul', 'ago', 'outra'])
  })

  it('desligar a recorrência mantém o registro e remove só os meses seguintes', async () => {
    db.expenses.push(
      expense({ id: 'ago', date: '2026-08-10', recurring: true, seriesId: 's' }),
      expense({ id: 'set', date: '2026-09-10', recurring: true, seriesId: 's' }),
      expense({ id: 'out', date: '2026-10-10', recurring: true, seriesId: 's' }),
    )

    const updated = await expenseService.update('set', payload({ date: '2026-09-10', recurring: false }))

    expect(updated.recurring).toBe(false)
    expect(db.expenses.map((item) => item.id)).toEqual(['ago', 'set'])
  })

  it('trocar a categoria de fixa para não fixa conta como desligar a recorrência', async () => {
    db.expenses.push(
      expense({ id: 'set', date: '2026-09-10', recurring: true, seriesId: 's' }),
      expense({ id: 'out', date: '2026-10-10', recurring: true, seriesId: 's' }),
    )

    const updated = await expenseService.update(
      'set',
      payload({ date: '2026-09-10', categoryId: categoryB, recurring: true }),
    )

    expect(updated.recurring).toBe(false)
    expect(db.expenses.map((item) => item.id)).toEqual(['set'])
  })

  it('religar a recorrência volta a criar o mês seguinte na mesma série', async () => {
    db.expenses.push(expense({ id: 'set', date: '2026-09-10', recurring: false, seriesId: 's' }))

    await expenseService.update('set', payload({ date: '2026-09-10', recurring: true }))

    expect(seriesMonths('s')).toEqual(['2026-09-10', '2026-10-10'])
  })

  it('editar um mês não altera os outros', async () => {
    db.expenses.push(
      expense({ id: 'ago', date: '2026-08-10', amount: 100, recurring: true, seriesId: 's' }),
      expense({ id: 'set', date: '2026-09-10', amount: 100, recurring: true, seriesId: 's' }),
    )

    await expenseService.update('set', payload({ date: '2026-09-10', amount: 250, recurring: true }))

    expect(db.expenses.find((item) => item.id === 'ago')!.amount).toBe(100)
    expect(db.expenses.find((item) => item.id === 'set')!.amount).toBe(250)
  })

  it('saída comum (não recorrente): criar, editar e excluir continuam funcionando', async () => {
    const created = await expenseService.create(payload({ description: 'Mercado', categoryId: categoryB }))
    await expenseService.update(created.id, payload({ description: 'Feira', categoryId: categoryB }))
    expect(db.expenses[0]!.description).toBe('Feira')

    await expenseService.remove(created.id)
    expect(db.expenses).toHaveLength(0)
  })
})

describe('meses seguintes alterados (mock)', () => {
  function series() {
    db.expenses.push(
      expense({ id: 'ago', date: '2026-08-10', recurring: true, seriesId: 's' }),
      expense({ id: 'set', date: '2026-09-10', recurring: true, seriesId: 's' }),
      expense({ id: 'out', date: '2026-10-10', recurring: true, seriesId: 's' }),
    )
  }

  const editOctober = (overrides: Partial<ExpensePayload> = { amount: 999 }) =>
    expenseService.update('out', payload({ date: '2026-10-10', recurring: true, ...overrides }))

  it('sem alteração nos meses seguintes, exclui direto', async () => {
    series()

    await expenseService.remove('set')

    expect(db.expenses.map((item) => item.id)).toEqual(['ago'])
  })

  it('com mês seguinte editado, recusa listando os meses e não remove nada', async () => {
    series()
    await editOctober()

    const error = await expenseService.remove('set').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(EditedMonthsError)
    expect((error as EditedMonthsError).months).toEqual(['2026-10'])
    expect(db.expenses.map((item) => item.id)).toEqual(['ago', 'set', 'out'])
  })

  it('com confirmação, remove o mês e os seguintes; anteriores intactos', async () => {
    series()
    await editOctober()

    await expenseService.remove('set', { confirm: true })

    expect(db.expenses.map((item) => item.id)).toEqual(['ago'])
  })

  it('marcar o mês seguinte como pago conta como alteração', async () => {
    series()
    await editOctober({ status: 'PAGO' })

    await expect(expenseService.remove('set')).rejects.toBeInstanceOf(EditedMonthsError)
  })

  it('alteração num mês anterior não exige confirmação', async () => {
    series()
    await expenseService.update('ago', payload({ date: '2026-08-10', amount: 1, recurring: true }))

    await expenseService.remove('set')

    expect(db.expenses.map((item) => item.id)).toEqual(['ago'])
  })

  it('desligar a recorrência com mês seguinte alterado recusa sem salvar nada', async () => {
    series()
    await editOctober()
    const before = structuredClone(db.expenses)

    await expect(
      expenseService.update('set', payload({ date: '2026-09-10', amount: 5, recurring: false })),
    ).rejects.toBeInstanceOf(EditedMonthsError)

    expect(db.expenses).toEqual(before)
  })

  it('desligar com confirmação mantém o mês e remove os seguintes', async () => {
    series()
    await editOctober()

    await expenseService.update('set', payload({ date: '2026-09-10', recurring: false }), { confirm: true })

    expect(db.expenses.map((item) => item.id)).toEqual(['ago', 'set'])
  })

  it('o mês seguinte gerado ao religar nasce sem alteração', async () => {
    db.expenses.push(
      expense({ id: 'set', date: '2026-09-10', recurring: false, seriesId: 's', manuallyEdited: true }),
    )

    await expenseService.update('set', payload({ date: '2026-09-10', recurring: true }))

    const october = db.expenses.find((item) => item.date === '2026-10-10')!
    expect(october.manuallyEdited).toBe(false)
  })
})
