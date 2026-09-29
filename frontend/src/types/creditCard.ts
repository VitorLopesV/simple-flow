import type { ID, Period, SelectOption } from './common'
import type { ExpenseType } from './expense'

/** Valores gravados no banco e devolvidos pela API. */
export type CardBrand = 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD'

export interface CreditCard {
  id: ID
  name: string
  brand: CardBrand
  /** Últimos 4 dígitos — nunca armazenamos o número completo. */
  lastDigits: string
  limit: number
  /** Dia do mês em que a fatura fecha (1-28). */
  closingDay: number
  /** Dia do mês de vencimento da fatura (1-28). */
  dueDay: number
  color: string
  active: boolean
  createdAt: string
}

export type CreditCardPayload = Omit<CreditCard, 'id' | 'createdAt'>

/**
 * Débito lançado direto no cartão — mesmo formato de uma `Expense`, sem forma de
 * pagamento (é sempre o cartão) e sem situação própria (quem é paga é a fatura).
 */
export interface CardTransaction {
  id: ID
  cardId: ID
  invoiceId: ID
  description: string
  amount: number
  date: string
  categoryId: ID
  type: ExpenseType
  installment: number
  totalInstallments: number
  recurring: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
  /**
   * Preenchido só nas ocorrências futuras projetadas a partir de uma transação
   * recorrente — nunca persistido, recalculado a cada leitura. A fatura a que
   * pertence pode inclusive ser virtual (ver `Invoice.id`), quando o mês ainda não
   * tem fatura própria.
   */
  recurrenceOriginId?: ID
}

export type CardTransactionPayload = Omit<
  CardTransaction,
  'id' | 'cardId' | 'invoiceId' | 'createdAt' | 'updatedAt' | 'recurrenceOriginId'
>

/** Valores gravados no banco e devolvidos pela API. */
export type InvoiceStatus = 'ABERTA' | 'FECHADA' | 'PAGA' | 'ATRASADA'

export interface Invoice {
  id: ID
  cardId: ID
  /** Competência no formato `YYYY-MM`. */
  referenceMonth: string
  closingDate: string
  dueDate: string
  total: number
  status: InvoiceStatus
  paidAt?: string | null
}

export interface DetailedInvoice extends Invoice {
  transactions: CardTransaction[]
}

export interface CreditCardWithInvoice {
  card: CreditCard
  invoice: DetailedInvoice | null
  /** Percentual do limite comprometido pela fatura em aberto (0-100). */
  limitUsage: number
}

export interface InvoiceFilter {
  cardId?: ID | null
  period: Period
}

export const CARD_BRAND_LABEL: Record<CardBrand, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  ELO: 'Elo',
  AMEX: 'American Express',
  HIPERCARD: 'Hipercard',
}

export const CARD_BRAND_OPTIONS: SelectOption<CardBrand>[] = (
  Object.keys(CARD_BRAND_LABEL) as CardBrand[]
).map((value) => ({ label: CARD_BRAND_LABEL[value], value }))

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  ABERTA: 'Aberta',
  FECHADA: 'Fechada',
  PAGA: 'Paga',
  ATRASADA: 'Atrasada',
}
