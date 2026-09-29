import type { ID, PageRequest, Period, SelectOption } from './common'

// Os valores dos tipos abaixo são os gravados no banco e devolvidos pela API, por
// isso continuam em português.

export type ExpenseStatus = 'PENDENTE' | 'PAGO'

export type PaymentMethod = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'BOLETO' | 'CARTAO_CREDITO'

/** Classificação específica da despesa, independente da categoria (fixa/variável/investimento). */
export type ExpenseType =
  | 'TRANSPORTE'
  | 'ALIMENTACAO'
  | 'LAZER'
  | 'CONTA'
  | 'POUPANCA'
  | 'ACOES'
  | 'EDUCACAO'
  | 'COMPRAS'
  | 'FARMACIA'
  | 'OUTROS'

export interface Expense {
  id: ID
  description: string
  /** Valor em BRL, sempre positivo. */
  amount: number
  /** Data de competência no formato ISO `YYYY-MM-DD`. */
  date: string
  categoryId: ID
  type: ExpenseType
  status: ExpenseStatus
  /** Data de vencimento da conta. Opcional: nem toda saída tem vencimento marcado. */
  dueDate?: string | null
  /**
   * Data em que a conta foi de fato paga. Definida pelo backend quando `status`
   * muda para 'PAGO' — não é um campo editável no formulário.
   */
  paidAt?: string | null
  paymentMethod: PaymentMethod
  /** Preenchido quando `paymentMethod === 'CARTAO_CREDITO'`. */
  cardId?: ID | null
  recurring: boolean
  notes?: string
  createdAt: string
  updatedAt: string
  /** true = gerado automaticamente a partir da fatura de um cartão (não editável/removível diretamente). */
  automatic?: boolean
  /**
   * Preenchido só nas ocorrências futuras projetadas a partir de um lançamento
   * recorrente (ver `withRecurrences` em `services/mock/db.ts`) — nunca persistidas,
   * recalculadas a cada leitura. Editar uma dessas ocorrências materializa uma linha
   * própria para aquele mês, independente do original em situação, data de
   * pagamento e valor.
   */
  recurrenceOriginId?: ID
}

export type ExpensePayload = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>

export interface ExpenseFilter extends PageRequest {
  period: Period
  categoryId?: ID | null
  status?: ExpenseStatus | null
  search?: string
}

export interface ExpenseSummary {
  total: number
  count: number
  average: number
  paidTotal: number
  pendingTotal: number
  previousMonthTotal: number
  byCategory: { categoryId: ID; name: string; color: string; total: number }[]
  /** Distribuição das saídas do período por `ExpenseType`. */
  byType: { type: ExpenseType; total: number }[]
}

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'Pix',
  DEBITO: 'Débito',
  BOLETO: 'Boleto',
  CARTAO_CREDITO: 'Cartão de crédito',
}

/**
 * Sem cartão de crédito: gasto no cartão é lançado na aba Cartões (fica preso ao
 * cartão) e chega na aba Saídas como a fatura inteira, uma saída derivada e só de
 * leitura. O rótulo continua no mapa acima porque essas linhas derivadas o exibem.
 */
export const PAYMENT_METHOD_OPTIONS: SelectOption<PaymentMethod>[] = (
  Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]
)
  .filter((value) => value !== 'CARTAO_CREDITO')
  .map((value) => ({ label: PAYMENT_METHOD_LABEL[value], value }))

export const EXPENSE_STATUS_OPTIONS: SelectOption<ExpenseStatus>[] = (
  Object.keys(EXPENSE_STATUS_LABEL) as ExpenseStatus[]
).map((value) => ({ label: EXPENSE_STATUS_LABEL[value], value }))

export const EXPENSE_TYPE_LABEL: Record<ExpenseType, string> = {
  TRANSPORTE: 'Transporte',
  ALIMENTACAO: 'Alimentação',
  LAZER: 'Lazer',
  CONTA: 'Conta',
  POUPANCA: 'Poupança',
  ACOES: 'Ações',
  EDUCACAO: 'Educação',
  COMPRAS: 'Compras',
  FARMACIA: 'Farmácia',
  OUTROS: 'Outros',
}

export const EXPENSE_TYPE_OPTIONS: SelectOption<ExpenseType>[] = (
  Object.keys(EXPENSE_TYPE_LABEL) as ExpenseType[]
).map((value) => ({ label: EXPENSE_TYPE_LABEL[value], value }))

/** Cor de cada tipo nos gráficos (Chart.js não lê CSS custom properties). */
export const EXPENSE_TYPE_COLOR: Record<ExpenseType, string> = {
  TRANSPORTE: '#0ea5e9',
  ALIMENTACAO: '#f97316',
  LAZER: '#a855f7',
  CONTA: '#6366f1',
  POUPANCA: '#10b981',
  ACOES: '#0891b2',
  EDUCACAO: '#eab308',
  COMPRAS: '#ec4899',
  FARMACIA: '#ef4444',
  OUTROS: '#94a3b8',
}
