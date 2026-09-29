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
  // Renda
  { name: 'Salário', type: 'RENDA', movement: 'ENTRADA', color: '#10b981' },
  { name: 'Freelance', type: 'RENDA', movement: 'ENTRADA', color: '#06b6d4' },
  { name: 'Reembolso', type: 'RENDA', movement: 'ENTRADA', color: '#84cc16' },
  { name: 'Benefício', type: 'RENDA', movement: 'ENTRADA', color: '#f97316' },
  { name: 'Outras receitas', type: 'OUTROS', movement: 'ENTRADA', color: '#94a3b8' },
  { name: 'Rendimentos', type: 'INVESTIMENTO', movement: 'ENTRADA', color: '#eab308' },
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

for (let offset = HISTORY_MONTHS - 1; offset >= 0; offset -= 1) {
  const period = addMonths(base, -offset)
  const salary = faker.number.int({ min: 7200, max: 7800 })

  incomes.push({
    id: newId('ent'),
    description: 'Salário mensal',
    amount: salary,
    date: dayInPeriod(period, 5),
    categoryId: categoryByName('Salário').id,
    recurring: true,
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
      categoryId: categoryByName('Freelance').id,
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
      categoryId: categoryByName('Rendimentos').id,
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
      categoryId: categoryByName('Reembolso').id,
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
 * Projeta, para um período-alvo, a ocorrência de cada série recorrente (agrupada
 * por descrição + categoria) que ainda não tenha lançamento real naquele período —
 * nunca persiste, recalcula a cada leitura a partir da ocorrência real mais recente
 * da série. Assim, desligar `recurring` no original (ou editar seu valor) já
 * reflete nos meses seguintes sozinho, sem nada pra apagar/sincronizar; e um mês que
 * já tem lançamento próprio (histórico real, ou editado à mão) não é duplicado.
 * `automatic` (fatura de cartão) fica de fora: aquelas já são geradas por período
 * pelo mecanismo de faturas.
 */
export function withRecurrences<
  T extends {
    id: ID
    date: string
    description: string
    categoryId: ID
    recurring: boolean
    recurrenceOriginId?: ID
    automatic?: boolean
    /** Só existe em Expense — quando presente, precisa avançar mês a mês junto com `date`. */
    dueDate?: string | null
  },
>(items: T[], targetPeriod: Period): T[] {
  const target = periodOrdinal(targetPeriod)
  const seriesKey = (item: T) => `${item.description}::${item.categoryId}`

  const alreadyPosted = new Set(
    items
      .filter((item) => periodOrdinal(periodOfDate(item.date)) === target)
      .map(seriesKey),
  )

  const latestBySeries = new Map<string, T>()
  for (const item of items) {
    if (!item.recurring || item.recurrenceOriginId || item.automatic) continue
    if (periodOrdinal(periodOfDate(item.date)) >= target) continue

    const key = seriesKey(item)
    const current = latestBySeries.get(key)
    if (!current || item.date > current.date) latestBySeries.set(key, item)
  }

  const projected = [...latestBySeries.entries()]
    .filter(([key]) => !alreadyPosted.has(key))
    .map(([, origin]) => ({
      ...origin,
      id: `${origin.id}_${toReferenceMonth(targetPeriod)}`,
      date: dayInPeriod(targetPeriod, toDate(origin.date).getDate()),
      // Some junto com `date`: sem isso, o formulário de saída (que usa o vencimento
      // como competência quando ele existe — ver TransactionForm.vue) reenviaria a
      // ocorrência para o mês do vencimento original ao editá-la, em vez do mês projetado.
      ...(origin.dueDate
        ? { dueDate: dayInPeriod(targetPeriod, toDate(origin.dueDate).getDate()) }
        : {}),
      // Projeção nunca herda a situação de pagamento do original (só existe em Expense):
      // cada mês começa pendente, senão pagar um mês marcaria todos os seguintes.
      ...('status' in origin ? { status: 'PENDENTE', paidAt: null } : {}),
      recurrenceOriginId: origin.id,
    }))

  return [...items, ...projected]
}

const PROJECTED_ID_REGEX = /^(.+)_(\d{4}-\d{2})$/

/**
 * Reconhece o id sintético de uma ocorrência projetada (`${originId}_${referenceMonth}`,
 * ver `withRecurrences`) e extrai o id do lançamento original. Espelha
 * `origemDoIdProjetado` do backend (`shared/utils/recorrencia.ts`).
 */
export function parseProjectedId(id: ID): { originId: ID; referenceMonth: string } | null {
  const found = id.match(PROJECTED_ID_REGEX)
  return found ? { originId: found[1]!, referenceMonth: found[2]! } : null
}
