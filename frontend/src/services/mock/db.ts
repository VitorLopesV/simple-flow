/**
 * Banco de dados em memória usado durante o desenvolvimento.
 *
 * A seed do faker é fixa para que os dados sejam estáveis entre reloads da
 * mesma sessão e entre máquinas — útil para revisar telas e comparar prints.
 * Os dados NÃO são persistidos: recarregar a página recria a base.
 *
 * Guarda os dados já no formato de domínio (em inglês): o mock substitui a API
 * inteira, então não passa pelos mappers de `services/mappers.ts`.
 */
import { faker } from '@faker-js/faker/locale/pt_BR'

import type { Category } from '@/types/category'
import { isFixedCategory } from '@/types/category'
import type { ID, Period } from '@/types/common'
import type { CardTransaction, CreditCard, Invoice } from '@/types/creditCard'
import type { Expense, ExpenseType, PaymentMethod } from '@/types/expense'
import type { Income } from '@/types/income'
import {
  addMonths,
  currentPeriod,
  dayInPeriod,
  fromReferenceMonth,
  toDate,
  toISODate,
  toReferenceMonth,
} from '@/utils/dateFormatter'

faker.seed(20260815)

let sequence = 0
export function newId(prefix: string): string {
  sequence += 1
  return `${prefix}_${sequence.toString().padStart(5, '0')}`
}

export function now(): string {
  return new Date().toISOString()
}

/** Clona para que consumidores não mutem o "banco" por referência. */
export function clone<T>(value: T): T {
  return structuredClone(value)
}

// ---------------------------------------------------------------- categorias

const SEED_CATEGORIES: Omit<Category, 'id'>[] = [
  // Saída — apenas os 3 grandes grupos; a classificação específica vai no campo `type` da Expense.
  { name: 'Despesa Fixa', type: 'CONTA_FIXA', movement: 'SAIDA', color: '#6366f1' },
  { name: 'Despesa Variável', type: 'CONTA_VARIAVEL', movement: 'SAIDA', color: '#14b8a6' },
  { name: 'Investimento', type: 'INVESTIMENTO', movement: 'SAIDA', color: '#0891b2' },
  // Entrada — mesmo modelo das saídas: a categoria é o grupo e o detalhe vai no `type` da Income.
  { name: 'Renda Fixa', type: 'RENDA_FIXA', movement: 'ENTRADA', color: '#10b981' },
  { name: 'Renda Variável', type: 'RENDA_VARIAVEL', movement: 'ENTRADA', color: '#06b6d4' },
  { name: 'Investimentos', type: 'INVESTIMENTO', movement: 'ENTRADA', color: '#eab308' },
  { name: 'Outros', type: 'OUTROS', movement: 'ENTRADA', color: '#94a3b8' },
]

export const categories: Category[] = SEED_CATEGORIES.map((category) => ({
  ...category,
  id: newId('cat'),
}))

function categoryByName(name: string): Category {
  const found = categories.find((category) => category.name === name)
  if (!found) throw new Error(`Categoria de semente ausente: ${name}`)
  return found
}

// ------------------------------------------------------------------- cartões

export const cards: CreditCard[] = [
  {
    id: newId('car'),
    name: 'Nubank Ultravioleta',
    brand: 'MASTERCARD',
    lastDigits: '4821',
    limit: 12_000,
    closingDay: 20,
    dueDay: 27,
    color: '#8b5cf6',
    active: true,
    createdAt: now(),
  },
  {
    id: newId('car'),
    name: 'Itaú Click',
    brand: 'VISA',
    lastDigits: '9013',
    limit: 7_500,
    closingDay: 5,
    dueDay: 12,
    color: '#f97316',
    active: true,
    createdAt: now(),
  },
  {
    id: newId('car'),
    name: 'Inter Gold',
    brand: 'ELO',
    lastDigits: '2277',
    limit: 4_000,
    closingDay: 25,
    dueDay: 3,
    color: '#ea580c',
    active: false,
    createdAt: now(),
  },
]

// ------------------------------------------------------------------ entradas

export const incomes: Income[] = []
export const expenses: Expense[] = []
export const invoices: Invoice[] = []
export const cardTransactions: CardTransaction[] = []

const HISTORY_MONTHS = 8
const base = currentPeriod()

// Cada lançamento recorrente pertence a uma série: os meses são registros próprios,
// independentes, ligados só pelo `seriesId`.
const salarySeries = newId('ser')
const fixedExpenseSeries = new Map<string, ID>()

for (let offset = HISTORY_MONTHS - 1; offset >= 0; offset -= 1) {
  const period = addMonths(base, -offset)
  const salary = faker.number.int({ min: 7200, max: 7800 })

  incomes.push({
    id: newId('ent'),
    description: 'Salário mensal',
    amount: salary,
    date: dayInPeriod(period, 5),
    categoryId: categoryByName('Renda Fixa').id,
    type: 'SALARIO',
    recurring: true,
    seriesId: salarySeries,
    notes: 'Crédito em conta corrente',
    createdAt: now(),
    updatedAt: now(),
  })

  const freelances = faker.number.int({ min: 0, max: 2 })
  for (let i = 0; i < freelances; i += 1) {
    incomes.push({
      id: newId('ent'),
      description: `Projeto ${faker.company.name()}`,
      amount: faker.number.int({ min: 800, max: 4200 }),
      date: dayInPeriod(period, faker.number.int({ min: 8, max: 26 })),
      categoryId: categoryByName('Renda Variável').id,
      type: 'FREELANCE',
      recurring: false,
      createdAt: now(),
      updatedAt: now(),
    })
  }

  if (faker.datatype.boolean(0.6)) {
    incomes.push({
      id: newId('ent'),
      description: 'Rendimento CDB',
      amount: faker.number.int({ min: 90, max: 620 }),
      date: dayInPeriod(period, faker.number.int({ min: 1, max: 28 })),
      categoryId: categoryByName('Investimentos').id,
      type: 'RENDIMENTOS',
      recurring: false,
      createdAt: now(),
      updatedAt: now(),
    })
  }

  if (faker.datatype.boolean(0.35)) {
    incomes.push({
      id: newId('ent'),
      description: 'Reembolso de despesas',
      amount: faker.number.int({ min: 120, max: 900 }),
      date: dayInPeriod(period, faker.number.int({ min: 10, max: 28 })),
      categoryId: categoryByName('Outros').id,
      type: 'REEMBOLSO',
      recurring: false,
      createdAt: now(),
      updatedAt: now(),
    })
  }

  // --- saídas fixas (categoria "Despesa Fixa"; tipo específico = "Conta")
  const fixed: [string, string, number, number, number][] = [
    ['Aluguel', 'Aluguel do apartamento', 1900, 1900, 10],
    ['Energia', 'Conta de energia', 130, 320, 15],
    ['Água', 'Conta de água', 60, 140, 15],
    ['Internet', 'Internet fibra 500MB', 119, 119, 8],
    ['Plano de Saúde', 'Plano de saúde familiar', 640, 690, 12],
  ]

  for (const [, description, min, max, day] of fixed) {
    if (!fixedExpenseSeries.has(description)) fixedExpenseSeries.set(description, newId('ser'))
    const dueDate = dayInPeriod(period, day)
    const status = offset === 0 && day > new Date().getDate() ? 'PENDENTE' : 'PAGO'

    expenses.push({
      id: newId('sai'),
      description,
      amount: faker.number.int({ min, max }),
      date: dueDate,
      categoryId: categoryByName('Despesa Fixa').id,
      type: 'CONTA',
      status,
      dueDate,
      paidAt: status === 'PAGO' ? dueDate : null,
      paymentMethod: faker.helpers.arrayElement<PaymentMethod>(['PIX', 'BOLETO', 'DEBITO']),
      cardId: null,
      recurring: true,
      seriesId: fixedExpenseSeries.get(description),
      createdAt: now(),
      updatedAt: now(),
    })
  }

  // --- saídas variáveis (categoria "Despesa Variável"; tipo varia conforme o gasto sorteado)
  const TYPE_BY_VARIABLE_EXPENSE: Record<string, ExpenseType> = {
    Alimentação: 'ALIMENTACAO',
    Transporte: 'TRANSPORTE',
    Lazer: 'LAZER',
    Compras: 'COMPRAS',
    Educação: 'EDUCACAO',
  }
  const variableCount = faker.number.int({ min: 8, max: 14 })
  for (let i = 0; i < variableCount; i += 1) {
    const spending = faker.helpers.arrayElement([
      'Alimentação',
      'Transporte',
      'Lazer',
      'Compras',
      'Educação',
    ])
    const day = faker.number.int({ min: 1, max: 28 })
    // Sem CARTAO_CREDITO: gasto no cartão é semeado em `cardTransactions` e chega
    // na aba Saídas pela fatura (ver `invoicesAsExpenses`) — aqui seria contado duas vezes.
    const paymentMethod = faker.helpers.arrayElement<PaymentMethod>(['PIX', 'DEBITO', 'DINHEIRO'])
    const date = dayInPeriod(period, day)
    const status = offset === 0 && day > new Date().getDate() ? 'PENDENTE' : 'PAGO'

    expenses.push({
      id: newId('sai'),
      description: variableDescription(spending),
      amount: faker.number.int({ min: 25, max: 780 }),
      date,
      categoryId: categoryByName('Despesa Variável').id,
      type: TYPE_BY_VARIABLE_EXPENSE[spending]!,
      status,
      paidAt: status === 'PAGO' ? date : null,
      paymentMethod,
      cardId: null,
      recurring: false,
      createdAt: now(),
      updatedAt: now(),
    })
  }

  // --- aporte em investimento (categoria "Investimento"; tipo = Poupança ou Ações)
  if (faker.datatype.boolean(0.7)) {
    const contribution = faker.helpers.arrayElement([
      { description: 'Aporte Tesouro Direto', type: 'ACOES' as const },
      { description: 'Compra de ações', type: 'ACOES' as const },
      { description: 'Aporte na poupança', type: 'POUPANCA' as const },
    ])

    const contributionDate = dayInPeriod(period, 6)

    expenses.push({
      id: newId('sai'),
      description: contribution.description,
      amount: faker.number.int({ min: 300, max: 2500 }),
      date: contributionDate,
      categoryId: categoryByName('Investimento').id,
      type: contribution.type,
      status: 'PAGO',
      paidAt: contributionDate,
      paymentMethod: 'PIX',
      cardId: null,
      recurring: false,
      createdAt: now(),
      updatedAt: now(),
    })
  }

  // --- faturas e transações de cartão
  for (const card of cards) {
    if (!card.active && offset > 2) continue

    const invoiceId = newId('fat')
    const count = faker.number.int({ min: 4, max: 11 })
    let total = 0

    for (let i = 0; i < count; i += 1) {
      const totalInstallments = faker.helpers.arrayElement([1, 1, 1, 2, 3, 6, 10])
      const amount = faker.number.int({ min: 32, max: 890 })
      total += amount

      cardTransactions.push({
        id: newId('trc'),
        cardId: card.id,
        invoiceId,
        description: faker.helpers.arrayElement([
          faker.company.name(),
          'Supermercado Real',
          'Posto Ipiranga',
          'Netflix',
          'Spotify',
          'iFood',
          'Amazon',
          'Farmácia São João',
          'Uber',
        ]),
        amount,
        date: dayInPeriod(period, faker.number.int({ min: 1, max: 28 })),
        categoryId: categoryByName('Despesa Variável').id,
        type: faker.helpers.arrayElement<ExpenseType>(['ALIMENTACAO', 'TRANSPORTE', 'LAZER', 'OUTROS']),
        installment: totalInstallments === 1 ? 1 : faker.number.int({ min: 1, max: totalInstallments }),
        totalInstallments,
        recurring: false,
        notes: null,
        createdAt: now(),
        updatedAt: now(),
      })
    }

    const dueDate = dayInPeriod(period, card.dueDay)
    const overdue = new Date(`${dueDate}T12:00:00`).getTime() < Date.now()

    invoices.push({
      id: invoiceId,
      cardId: card.id,
      referenceMonth: toReferenceMonth(period),
      closingDate: dayInPeriod(period, card.closingDay),
      dueDate,
      total,
      status: offset === 0 ? (overdue ? 'ATRASADA' : 'ABERTA') : 'PAGA',
      paidAt: offset === 0 ? null : dueDate,
    })
  }
}

function variableDescription(category: string): string {
  switch (category) {
    case 'Alimentação':
      return faker.helpers.arrayElement([
        'Supermercado do mês',
        'Feira da semana',
        'Almoço no trabalho',
        'Padaria',
        'Delivery',
      ])
    case 'Transporte':
      return faker.helpers.arrayElement(['Combustível', 'Aplicativo de corrida', 'Estacionamento', 'Recarga do bilhete'])
    case 'Lazer':
      return faker.helpers.arrayElement(['Cinema', 'Show', 'Jantar fora', 'Assinatura de streaming'])
    case 'Compras':
      return faker.helpers.arrayElement(['Roupas', 'Eletrônico', 'Item para casa', 'Presente'])
    default:
      return faker.helpers.arrayElement(['Curso online', 'Livro técnico', 'Mensalidade do curso'])
  }
}

/**
 * Fatura da competência do cartão, criada como ABERTA na primeira transação do mês —
 * espelha `garantirFatura` do `SupabaseFaturaRepository`.
 */
export function ensureInvoice(cardId: ID, referenceMonth: string): Invoice {
  const existing = invoices.find(
    (invoice) => invoice.cardId === cardId && invoice.referenceMonth === referenceMonth,
  )
  if (existing) return existing

  const card = cards.find((item) => item.id === cardId)
  if (!card) throw new Error('Cartão não encontrado.')

  const period = fromReferenceMonth(referenceMonth)
  const created: Invoice = {
    id: newId('fat'),
    cardId,
    referenceMonth,
    closingDate: dayInPeriod(period, card.closingDay),
    dueDate: dayInPeriod(period, card.dueDay),
    total: 0,
    status: 'ABERTA',
    paidAt: null,
  }
  invoices.push(created)
  return created
}

/** O total da fatura é sempre a soma das transações — evita saldo torto por delta perdido. */
export function recalculateInvoiceTotal(invoiceId: ID): void {
  const invoice = invoices.find((item) => item.id === invoiceId)
  if (!invoice) return

  invoice.total = cardTransactions
    .filter((transaction) => transaction.invoiceId === invoiceId)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
}

/**
 * Cada cartão com fatura no período vira uma "saída" derivada, com o valor
 * sempre lido ao vivo da fatura — nunca duplicado/armazenado, então qualquer
 * mudança no total da fatura (hoje só via seed; futuramente via lançamentos
 * no cartão) já aparece aqui sem sincronização manual.
 */
function invoicesAsExpenses(): Expense[] {
  const invoiceCategory = categoryByName('Despesa Variável')
  return invoices.filter((invoice) => invoice.total > 0).map((invoice) => {
    const card = cards.find((item) => item.id === invoice.cardId)
    return {
      id: `sai_fat_${invoice.id}`,
      description: `Fatura – ${card?.name ?? 'Cartão'}`,
      amount: invoice.total,
      date: invoice.dueDate,
      categoryId: invoiceCategory.id,
      type: 'CONTA',
      status: invoice.status === 'PAGA' ? 'PAGO' : 'PENDENTE',
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      paymentMethod: 'CARTAO_CREDITO',
      cardId: invoice.cardId,
      recurring: true,
      createdAt: '',
      updatedAt: '',
      automatic: true,
    }
  })
}

/** Saídas reais + uma por fatura de cartão do período (ver `invoicesAsExpenses`). */
export function expensesWithInvoices(): Expense[] {
  return [...expenses, ...invoicesAsExpenses()]
}

/** Data ISO de hoje — usada como valor padrão nos formulários. */
export const todayISO = toISODate(new Date())

function periodOfDate(iso: string): Period {
  const date = toDate(iso)
  return { month: date.getMonth() + 1, year: date.getFullYear() }
}

function periodOrdinal(period: Period): number {
  return period.year * 12 + period.month
}

/**
 * Primeiro mês com algum registro do usuário (entrada, saída ou transação de cartão) —
 * espelha o endpoint de limites de navegação do backend. Sem registros, é o mês atual.
 */
export function firstRecordMonth(): Period {
  const dates = [...incomes, ...expenses, ...cardTransactions].map((record) => record.date)
  if (!dates.length) return currentPeriod()

  const first = dates.reduce((earliest, date) => (date < earliest ? date : earliest))
  return periodOfDate(first)
}

// ------------------------------------------------------------------ recorrência

/** Mensagem do 422 do backend para recorrência fora de Renda Fixa / Despesa Fixa. */
export const RECURRING_ONLY_FIXED = 'Lançamento recorrente só é permitido em Renda Fixa ou Despesa Fixa.'

/** Despesa Fixa / Renda Fixa: só elas aceitam recorrência. */
export function isFixedCategoryId(id: ID | null | undefined): boolean {
  return isFixedCategory(categories.find((category) => category.id === id))
}

/** Mesmo dia no mês seguinte, limitado ao último dia dele (31/01 → 28/02). */
export function sameDayNextMonth(iso: string): string {
  return dayInPeriod(addMonths(periodOfDate(iso), 1), toDate(iso).getDate())
}

interface SeriesRecord {
  id: ID
  date: string
  seriesId?: ID | null
}

/** Registros da mesma série nos meses posteriores ao do registro (os anteriores ficam de fora). */
export function laterInSeries<T extends SeriesRecord>(items: T[], record: T): T[] {
  if (!record.seriesId) return []
  const month = periodOrdinal(periodOfDate(record.date))
  return items.filter(
    (item) =>
      item.seriesId === record.seriesId &&
      item.id !== record.id &&
      periodOrdinal(periodOfDate(item.date)) > month,
  )
}

function hasNextMonthInSeries<T extends SeriesRecord>(items: T[], record: T): boolean {
  const next = periodOrdinal(periodOfDate(record.date)) + 1
  return laterInSeries(items, record).some((item) => periodOrdinal(periodOfDate(item.date)) === next)
}

/** Remove os registros informados da coleção (por id), sem trocar a referência do array. */
export function removeRecords<T extends { id: ID }>(items: T[], toRemove: T[]): void {
  const ids = new Set(toRemove.map((item) => item.id))
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (ids.has(items[i]!.id)) items.splice(i, 1)
  }
}

/**
 * Cria o registro do mês seguinte de uma entrada recorrente, se a série ainda não o
 * tiver — cópia independente, no mesmo dia (limitado ao fim do mês).
 */
export function ensureNextIncome(income: Income): void {
  if (!income.recurring || !income.seriesId || hasNextMonthInSeries(incomes, income)) return
  incomes.push({
    ...structuredClone(income),
    id: newId('ent'),
    date: sameDayNextMonth(income.date),
    createdAt: now(),
    updatedAt: now(),
  })
}

/** Mesmo que `ensureNextIncome`, para saídas: o mês seguinte sempre nasce PENDENTE. */
export function ensureNextExpense(expense: Expense): void {
  if (!expense.recurring || !expense.seriesId || hasNextMonthInSeries(expenses, expense)) return
  expenses.push({
    ...structuredClone(expense),
    id: newId('sai'),
    date: sameDayNextMonth(expense.date),
    dueDate: expense.dueDate ? sameDayNextMonth(expense.dueDate) : expense.dueDate,
    status: 'PENDENTE',
    paidAt: null,
    createdAt: now(),
    updatedAt: now(),
  })
}

/**
 * Mesmo que `ensureNextIncome`, para transações de cartão: o débito do mês seguinte
 * entra na fatura daquele mês (criada se ainda não existir).
 */
export function ensureNextCardTransaction(transaction: CardTransaction): void {
  if (
    !transaction.recurring ||
    !transaction.seriesId ||
    hasNextMonthInSeries(cardTransactions, transaction)
  ) {
    return
  }

  const date = sameDayNextMonth(transaction.date)
  const invoice = ensureInvoice(transaction.cardId, date.slice(0, 7))
  cardTransactions.push({
    ...structuredClone(transaction),
    id: newId('trc'),
    invoiceId: invoice.id,
    date,
    createdAt: now(),
    updatedAt: now(),
  })
  recalculateInvoiceTotal(invoice.id)
}

/**
 * Espelha o job agendado do backend: copia para o mês seguinte os registros recorrentes
 * do mês de referência que ainda não têm o próximo mês. Idempotente.
 */
export function generateNextMonth(reference: Period = currentPeriod()): void {
  const inReference = (record: { date: string }) =>
    periodOrdinal(periodOfDate(record.date)) === periodOrdinal(reference)

  incomes.filter(inReference).forEach(ensureNextIncome)
  expenses.filter(inReference).forEach(ensureNextExpense)
  cardTransactions.filter(inReference).forEach(ensureNextCardTransaction)
}

// A base semeada já tem o mês seguinte das séries, como o job deixaria.
generateNextMonth(base)
