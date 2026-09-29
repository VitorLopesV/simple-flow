import type {
  CardTransaction,
  CardTransactionPayload,
  CreditCard,
  CreditCardPayload,
  CreditCardWithInvoice,
  DetailedInvoice,
  InvoiceFilter,
} from '@/types/creditCard'
import type { CardTransactionDto, CreditCardDto, CreditCardWithInvoiceDto } from '@/types/dto'
import { toReferenceMonth } from '@/utils/dateFormatter'
import { http, USE_MOCK } from './http'
import {
  toCardTransaction,
  toCardTransactionPayloadDto,
  toCreditCard,
  toCreditCardPayloadDto,
  toCreditCardWithInvoice,
} from './mappers'
import { delay, mockDb } from './mock'

export const creditCardService = {
  async list(): Promise<CreditCard[]> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(
        db
          .clone(db.cards)
          .sort(
            (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'),
          ),
      )
    }

    const { data } = await http.get<CreditCardDto[]>('/cartoes')
    return data.map(toCreditCard)
  },

  /** Cartões já combinados com a fatura da competência escolhida. */
  async listWithInvoices(filter: InvoiceFilter): Promise<CreditCardWithInvoice[]> {
    const referenceMonth = toReferenceMonth(filter.period)

    if (USE_MOCK) {
      const db = await mockDb()

      const buildInvoice = (cardId: string): DetailedInvoice | null => {
        const invoice = db.invoices.find(
          (item) => item.cardId === cardId && item.referenceMonth === referenceMonth,
        )
        if (!invoice) return null

        return {
          ...invoice,
          transactions: db.cardTransactions
            .filter((transaction) => transaction.invoiceId === invoice.id)
            .sort((a, b) => b.date.localeCompare(a.date)),
        }
      }

      const targets = filter.cardId
        ? db.cards.filter((card) => card.id === filter.cardId)
        : db.cards

      const result: CreditCardWithInvoice[] = targets
        .slice()
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'))
        .map((card) => {
          const invoice = buildInvoice(card.id)
          return {
            card: db.clone(card),
            invoice: invoice ? db.clone(invoice) : null,
            limitUsage: invoice && card.limit > 0 ? (invoice.total / card.limit) * 100 : 0,
          }
        })

      return delay(result)
    }

    const { data } = await http.get<CreditCardWithInvoiceDto[]>('/cartoes/faturas', {
      params: { competencia: referenceMonth, cartaoId: filter.cardId ?? undefined },
    })
    return data.map(toCreditCardWithInvoice)
  },

  async create(payload: CreditCardPayload): Promise<CreditCard> {
    if (USE_MOCK) {
      const db = await mockDb()
      const card: CreditCard = { ...payload, id: db.newId('car'), createdAt: db.now() }
      db.cards.push(card)
      return delay(db.clone(card))
    }

    const { data } = await http.post<CreditCardDto>('/cartoes', toCreditCardPayloadDto(payload))
    return toCreditCard(data)
  },

  async update(id: string, payload: CreditCardPayload): Promise<CreditCard> {
    if (USE_MOCK) {
      const db = await mockDb()
      const index = db.cards.findIndex((card) => card.id === id)
      if (index < 0) throw new Error('Cartão não encontrado.')

      const updated: CreditCard = { ...db.cards[index]!, ...payload }
      db.cards[index] = updated
      return delay(db.clone(updated))
    }

    const { data } = await http.put<CreditCardDto>(`/cartoes/${id}`, toCreditCardPayloadDto(payload))
    return toCreditCard(data)
  },

  async remove(id: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const index = db.cards.findIndex((card) => card.id === id)
      if (index < 0) throw new Error('Cartão não encontrado.')
      db.cards.splice(index, 1)

      // Remove faturas e transações órfãs do cartão excluído.
      const cardInvoices = db.invoices
        .filter((invoice) => invoice.cardId === id)
        .map((invoice) => invoice.id)

      for (let i = db.cardTransactions.length - 1; i >= 0; i -= 1) {
        if (cardInvoices.includes(db.cardTransactions[i]!.invoiceId)) {
          db.cardTransactions.splice(i, 1)
        }
      }
      for (let i = db.invoices.length - 1; i >= 0; i -= 1) {
        if (db.invoices[i]!.cardId === id) db.invoices.splice(i, 1)
      }

      return delay(undefined)
    }

    await http.delete(`/cartoes/${id}`)
  },

  /**
   * Débito lançado direto no cartão — a fatura da competência da data é criada
   * como ABERTA se ainda não existir e passa a somar o débito.
   */
  async createTransaction(cardId: string, payload: CardTransactionPayload): Promise<CardTransaction> {
    if (USE_MOCK) {
      const db = await mockDb()
      const invoice = db.ensureInvoice(cardId, payload.date.slice(0, 7))

      const transaction: CardTransaction = {
        ...payload,
        id: db.newId('trc'),
        cardId,
        invoiceId: invoice.id,
        createdAt: db.now(),
        updatedAt: db.now(),
      }
      db.cardTransactions.push(transaction)
      db.recalculateInvoiceTotal(invoice.id)

      return delay(db.clone(transaction))
    }

    const { data } = await http.post<CardTransactionDto>(
      `/cartoes/${cardId}/transacoes`,
      toCardTransactionPayloadDto(payload),
    )
    return toCardTransaction(data)
  },

  /** Mudar a data pode mover o débito para a fatura de outra competência. */
  async updateTransaction(
    cardId: string,
    id: string,
    payload: CardTransactionPayload,
  ): Promise<CardTransaction> {
    if (USE_MOCK) {
      const db = await mockDb()
      const index = db.cardTransactions.findIndex((transaction) => transaction.id === id)
      if (index < 0) throw new Error('Transação não encontrada.')

      const previous = db.cardTransactions[index]!
      const invoice = db.ensureInvoice(cardId, payload.date.slice(0, 7))

      const updated: CardTransaction = {
        ...previous,
        ...payload,
        invoiceId: invoice.id,
        updatedAt: db.now(),
      }
      db.cardTransactions[index] = updated

      db.recalculateInvoiceTotal(previous.invoiceId)
      if (invoice.id !== previous.invoiceId) db.recalculateInvoiceTotal(invoice.id)

      return delay(db.clone(updated))
    }

    const { data } = await http.put<CardTransactionDto>(
      `/cartoes/${cardId}/transacoes/${id}`,
      toCardTransactionPayloadDto(payload),
    )
    return toCardTransaction(data)
  },

  async removeTransaction(cardId: string, id: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const index = db.cardTransactions.findIndex((transaction) => transaction.id === id)
      if (index < 0) throw new Error('Transação não encontrada.')

      const [removed] = db.cardTransactions.splice(index, 1)
      db.recalculateInvoiceTotal(removed!.invoiceId)

      return delay(undefined)
    }

    await http.delete(`/cartoes/${cardId}/transacoes/${id}`)
  },

  async payInvoice(invoiceId: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const invoice = db.invoices.find((item) => item.id === invoiceId)
      if (!invoice) throw new Error('Fatura não encontrada.')

      invoice.status = 'PAGA'
      invoice.paidAt = new Date().toISOString().slice(0, 10)
      return delay(undefined)
    }

    await http.patch(`/faturas/${invoiceId}/pagar`)
  },
}
