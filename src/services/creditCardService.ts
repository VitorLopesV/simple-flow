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
import type { SeriesChangeOptions } from '@/types/common'
import { toReferenceMonth } from '@/utils/dateFormatter'
import { asEditedMonthsError, EditedMonthsError, http, USE_MOCK } from './http'
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
      if (payload.recurring && !db.isFixedCategoryId(payload.categoryId)) {
        throw new Error(db.RECURRING_ONLY_FIXED)
      }

      const invoice = db.ensureInvoice(cardId, payload.date.slice(0, 7))

      const transaction: CardTransaction = {
        ...payload,
        id: db.newId('trc'),
        cardId,
        invoiceId: invoice.id,
        seriesId: payload.recurring ? db.newId('ser') : null,
        createdAt: db.now(),
        updatedAt: db.now(),
      }
      db.cardTransactions.push(transaction)
      db.recalculateInvoiceTotal(invoice.id)
      // Recorrente: o débito do mês seguinte já entra na fatura daquele mês.
      db.ensureNextCardTransaction(transaction)

      return delay(db.clone(transaction))
    }

    const { data } = await http.post<CardTransactionDto>(
      `/cartoes/${cardId}/transacoes`,
      toCardTransactionPayloadDto(payload),
    )
    return toCardTransaction(data)
  },

  /**
   * Mudar a data pode mover o débito para a fatura de outra competência. Desligar a
   * recorrência remove os meses seguintes — os alterados só com `options.confirm`.
   */
  async updateTransaction(
    cardId: string,
    id: string,
    payload: CardTransactionPayload,
    options: SeriesChangeOptions = {},
  ): Promise<CardTransaction> {
    if (USE_MOCK) {
      const db = await mockDb()
      const index = db.cardTransactions.findIndex((transaction) => transaction.id === id)
      if (index < 0) throw new Error('Transação não encontrada.')

      const previous = db.cardTransactions[index]!

      // Trocar para uma categoria não fixa conta como desligar a recorrência.
      const recurring = payload.recurring && db.isFixedCategoryId(payload.categoryId)
      const deactivating = previous.recurring && !recurring
      const edited = deactivating ? db.editedLaterMonths(db.cardTransactions, previous) : []
      if (edited.length && !options.confirm) throw new EditedMonthsError(edited)

      const invoice = db.ensureInvoice(cardId, payload.date.slice(0, 7))
      const description = previous.recurring && recurring ? previous.description : payload.description

      const updated: CardTransaction = {
        ...previous,
        ...payload,
        recurring,
        description,
        invoiceId: invoice.id,
        seriesId: previous.seriesId ?? (recurring ? db.newId('ser') : null),
        manuallyEdited: true,
        updatedAt: db.now(),
      }
      db.cardTransactions[index] = updated

      const touched = new Set([previous.invoiceId, invoice.id])
      if (deactivating) {
        const later = db.laterInSeries(db.cardTransactions, previous)
        later.forEach((transaction) => touched.add(transaction.invoiceId))
        db.removeRecords(db.cardTransactions, later)
      }
      touched.forEach((invoiceId) => db.recalculateInvoiceTotal(invoiceId))
      if (!previous.recurring && recurring) db.ensureNextCardTransaction(updated)

      return delay(db.clone(updated))
    }

    try {
      const { data } = await http.put<CardTransactionDto>(
        `/cartoes/${cardId}/transacoes/${id}`,
        toCardTransactionPayloadDto(payload),
        { params: { confirmar: options.confirm || undefined } },
      )
      return toCardTransaction(data)
    } catch (error) {
      throw asEditedMonthsError(error)
    }
  },

  /** Remove o mês e os seguintes da série; meses seguintes alterados exigem `options.confirm`. */
  async removeTransaction(cardId: string, id: string, options: SeriesChangeOptions = {}): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const transaction = db.cardTransactions.find((item) => item.id === id)
      if (!transaction) throw new Error('Transação não encontrada.')

      const edited = db.editedLaterMonths(db.cardTransactions, transaction)
      if (edited.length && !options.confirm) throw new EditedMonthsError(edited)

      // Excluir um mês da série remove ele e os seguintes; os anteriores ficam intactos.
      const removed = [transaction, ...db.laterInSeries(db.cardTransactions, transaction)]
      db.removeRecords(db.cardTransactions, removed)
      new Set(removed.map((item) => item.invoiceId)).forEach((invoiceId) =>
        db.recalculateInvoiceTotal(invoiceId),
      )

      return delay(undefined)
    }

    try {
      await http.delete(`/cartoes/${cardId}/transacoes/${id}`, {
        params: { confirmar: options.confirm || undefined },
      })
    } catch (error) {
      throw asEditedMonthsError(error)
    }
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
