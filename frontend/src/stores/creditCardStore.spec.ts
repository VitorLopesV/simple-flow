import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { creditCardService } from '@/services/creditCardService'
import { useCreditCardStore } from '@/stores/creditCardStore'
import { usePeriodStore } from '@/stores/periodStore'
import type {
  CreditCard,
  CreditCardWithInvoice,
  CreditCardPayload,
  InvoiceStatus,
  CardTransaction,
  CardTransactionPayload,
} from '@/types/creditCard'

vi.mock('@/services/creditCardService', () => ({
  creditCardService: {
    listWithInvoices: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    createTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    removeTransaction: vi.fn(),
    payInvoice: vi.fn(),
  },
}))

const service = vi.mocked(creditCardService)

function card(id: string, overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id,
    name: `Cartão ${id}`,
    brand: 'VISA',
    lastDigits: '1234',
    limit: 1000,
    closingDay: 20,
    dueDay: 27,
    color: '#000000',
    active: true,
    createdAt: '',
    ...overrides,
  }
}

function transaction(id: string, overrides: Partial<CardTransaction> = {}): CardTransaction {
  return {
    id,
    cardId: 'A',
    invoiceId: 'fat_A',
    description: `Compra ${id}`,
    amount: 50,
    date: '2026-08-10',
    categoryId: 'cat_1',
    type: 'OUTROS',
    installment: 1,
    totalInstallments: 1,
    recurring: false,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

interface WithInvoiceOptions {
  card?: Partial<CreditCard>
  /** `null` = cartão sem fatura na competência. */
  invoice?: { total?: number; status?: InvoiceStatus; transactions?: CardTransaction[] } | null
}

function withInvoice(id: string, { card: cardData = {}, invoice = {} }: WithInvoiceOptions = {}): CreditCardWithInvoice {
  return {
    card: card(id, cardData),
    invoice:
      invoice === null
        ? null
        : {
            id: `fat_${id}`,
            cardId: id,
            referenceMonth: '2026-08',
            closingDate: '2026-08-20',
            dueDate: '2026-08-27',
            total: invoice.total ?? 0,
            status: invoice.status ?? 'ABERTA',
            paidAt: null,
            transactions: invoice.transactions ?? [],
          },
    limitUsage: 0,
  }
}

const CARD_PAYLOAD: CreditCardPayload = {
  name: 'Novo',
  brand: 'ELO',
  lastDigits: '9999',
  limit: 500,
  closingDay: 10,
  dueDay: 17,
  color: '#ffffff',
  active: true,
}

function transactionPayload(overrides: Partial<CardTransactionPayload> = {}): CardTransactionPayload {
  return {
    description: 'Notebook',
    amount: 100,
    date: '2026-08-10',
    categoryId: 'cat_1',
    type: 'OUTROS',
    installment: 1,
    totalInstallments: 1,
    recurring: false,
    notes: 'presente',
    ...overrides,
  }
}

/** Store já carregado com a lista informada. */
async function storeWith(list: CreditCardWithInvoice[]) {
  service.listWithInvoices.mockResolvedValue(list)
  const store = useCreditCardStore()
  await store.load()
  return store
}

/** Chamadas de `criarTransacao` decompostas em (cartaoId, payload). */
function sentInstallments(): { cardId: string; payload: CardTransactionPayload }[] {
  return service.createTransaction.mock.calls.map(([cardId, payload]) => ({ cardId, payload }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  usePeriodStore().set({ month: 8, year: 2026 })

  vi.resetAllMocks()
  service.listWithInvoices.mockResolvedValue([withInvoice('A'), withInvoice('B')])
  service.create.mockResolvedValue(card('B'))
  service.update.mockResolvedValue(card('A'))
  service.remove.mockResolvedValue(undefined)
  service.createTransaction.mockResolvedValue(transaction('created'))
  service.updateTransaction.mockResolvedValue(transaction('t1'))
  service.removeTransaction.mockResolvedValue(undefined)
  service.payInvoice.mockResolvedValue(undefined)
})

describe('createTransaction: parcelamento', () => {
  it('à vista (totalInstallments 1) faz uma única chamada com o payload original', async () => {
    const store = useCreditCardStore()
    const payload = transactionPayload({ amount: 100, totalInstallments: 1 })

    const ok = await store.createTransaction('A', payload)

    expect(ok).toBe(true)
    expect(service.createTransaction).toHaveBeenCalledTimes(1)
    expect(service.createTransaction).toHaveBeenCalledWith('A', payload)
    expect(service.listWithInvoices).toHaveBeenCalledTimes(1)
    expect(store.saving).toBe(false)
  })

  it('totalInstallments 0 é tratado como à vista', async () => {
    const store = useCreditCardStore()
    const payload = transactionPayload({ totalInstallments: 0 })

    await store.createTransaction('A', payload)

    expect(service.createTransaction).toHaveBeenCalledTimes(1)
    expect(service.createTransaction).toHaveBeenCalledWith('A', payload)
  })

  it('3 parcelas de R$ 100,00 dão 33,34 / 33,33 / 33,33, com o resto nas primeiras', async () => {
    const store = useCreditCardStore()

    await store.createTransaction('A', transactionPayload({ amount: 100, totalInstallments: 3 }))

    expect(sentInstallments().map((p) => p.payload.amount)).toEqual([33.34, 33.33, 33.33])
  })

  it.each([
    [100, 3],
    [100, 7],
    [19.99, 3],
    [1234.56, 12],
    [99.99, 10],
    [0.1 + 0.2, 3],
    [0.05, 4],
    [1000, 6],
  ])('a soma das parcelas de %f em %i vezes é exatamente o valor original', async (amount, installments) => {
    const store = useCreditCardStore()

    await store.createTransaction('A', transactionPayload({ amount, totalInstallments: installments }))

    const cents = sentInstallments().map((p) => Math.round(p.payload.amount * 100))
    expect(cents).toHaveLength(installments)
    expect(cents.reduce((sum, c) => sum + c, 0)).toBe(Math.round(amount * 100))
    // O resto fica nas primeiras: nunca uma parcela posterior maior que a anterior.
    for (let i = 1; i < cents.length; i += 1) expect(cents[i]!).toBeLessThanOrEqual(cents[i - 1]!)
    expect(Math.max(...cents) - Math.min(...cents)).toBeLessThanOrEqual(1)
  })

  it('numera as parcelas de 1 a N com totalInstallments e preserva os demais campos', async () => {
    const store = useCreditCardStore()

    await store.createTransaction('A', transactionPayload({ amount: 90, totalInstallments: 3 }))

    const sent = sentInstallments()
    expect(sent.map((p) => p.cardId)).toEqual(['A', 'A', 'A'])
    expect(sent.map((p) => p.payload.installment)).toEqual([1, 2, 3])
    expect(sent.every((p) => p.payload.totalInstallments === 3)).toBe(true)
    for (const { payload } of sent) {
      expect(payload).toMatchObject({
        description: 'Notebook',
        categoryId: 'cat_1',
        type: 'OUTROS',
        notes: 'presente',
        recurring: false,
      })
    }
  })

  it('12 parcelas iniciando em novembro atravessam a virada de ano', async () => {
    const store = useCreditCardStore()

    await store.createTransaction('A', transactionPayload({ date: '2026-11-15', amount: 1200, totalInstallments: 12 }))

    expect(sentInstallments().map((p) => p.payload.date)).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
      '2027-02-15',
      '2027-03-15',
      '2027-04-15',
      '2027-05-15',
      '2027-06-15',
      '2027-07-15',
      '2027-08-15',
      '2027-09-15',
      '2027-10-15',
    ])
  })

  it('compra no dia 31 cai no último dia dos meses curtos', async () => {
    const store = useCreditCardStore()

    await store.createTransaction('A', transactionPayload({ date: '2026-01-31', amount: 400, totalInstallments: 4 }))

    expect(sentInstallments().map((p) => p.payload.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('respeita ano bissexto em fevereiro', async () => {
    const store = useCreditCardStore()

    await store.createTransaction('A', transactionPayload({ date: '2027-12-31', amount: 300, totalInstallments: 3 }))

    expect(sentInstallments().map((p) => p.payload.date)).toEqual(['2027-12-31', '2028-01-31', '2028-02-29'])
  })

  it('dispara as parcelas em paralelo, sem esperar uma terminar para iniciar a próxima', async () => {
    const resolvers: (() => void)[] = []
    service.createTransaction.mockImplementation(
      () => new Promise((resolve) => resolvers.push(() => resolve(transaction('x')))),
    )
    const store = useCreditCardStore()

    const promessa = store.createTransaction('A', transactionPayload({ amount: 300, totalInstallments: 3 }))

    expect(service.createTransaction).toHaveBeenCalledTimes(3)
    expect(store.saving).toBe(true)
    resolvers.forEach((resolve) => resolve())
    await promessa
    expect(store.saving).toBe(false)
  })

  it('recarrega os cartões uma única vez depois de todas as parcelas', async () => {
    const store = useCreditCardStore()

    await store.createTransaction('A', transactionPayload({ amount: 300, totalInstallments: 3 }))

    expect(service.listWithInvoices).toHaveBeenCalledTimes(1)
  })

  it('falha no meio: retorna false, preenche erro, desliga salvando e não recarrega', async () => {
    service.createTransaction
      .mockResolvedValueOnce(transaction('p1'))
      .mockRejectedValueOnce(new Error('Limite excedido'))
      .mockResolvedValueOnce(transaction('p3'))
    const store = useCreditCardStore()

    const ok = await store.createTransaction('A', transactionPayload({ amount: 300, totalInstallments: 3 }))

    expect(ok).toBe(false)
    expect(store.error).toBe('Limite excedido')
    expect(store.saving).toBe(false)
    expect(service.listWithInvoices).not.toHaveBeenCalled()
  })

  it('falha à vista sem mensagem aproveitável usa o texto padrão', async () => {
    service.createTransaction.mockRejectedValue('quebrou')
    const store = useCreditCardStore()

    const ok = await store.createTransaction('A', transactionPayload())

    expect(ok).toBe(false)
    expect(store.error).toBe('Não foi possível salvar o débito.')
  })
})

describe('carregar e seleção', () => {
  it('usa o período do periodoStore e preenche os cartões', async () => {
    usePeriodStore().set({ month: 3, year: 2025 })
    const list = [withInvoice('A'), withInvoice('B')]
    service.listWithInvoices.mockResolvedValue(list)
    const store = useCreditCardStore()

    await store.load()

    expect(service.listWithInvoices).toHaveBeenCalledWith({ period: { month: 3, year: 2025 } })
    expect(store.cards).toEqual(list)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('mantém loading verdadeiro durante a chamada', async () => {
    let finish!: () => void
    service.listWithInvoices.mockReturnValue(new Promise((resolve) => (finish = () => resolve([]))))
    const store = useCreditCardStore()

    const promessa = store.load()
    expect(store.loading).toBe(true)
    finish()
    await promessa

    expect(store.loading).toBe(false)
  })

  it('falha: preenche erro, zera os cartões e desliga o loading', async () => {
    const store = await storeWith([withInvoice('A')])
    service.listWithInvoices.mockRejectedValue(new Error('Servidor fora do ar'))

    await store.load()

    expect(store.error).toBe('Servidor fora do ar')
    expect(store.cards).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('falha sem mensagem aproveitável usa o texto padrão', async () => {
    service.listWithInvoices.mockRejectedValue('quebrou')
    const store = useCreditCardStore()

    await store.load()

    expect(store.error).toBe('Não foi possível carregar os cartões.')
  })

  it('seleciona o primeiro cartão na primeira carga', async () => {
    const store = await storeWith([withInvoice('A'), withInvoice('B')])

    expect(store.selectedCardId).toBe('A')
    expect(store.selected?.card.id).toBe('A')
  })

  it('mantém o cartão selecionado enquanto ele ainda existe', async () => {
    const store = await storeWith([withInvoice('A'), withInvoice('B')])
    store.select('B')

    await store.load()

    expect(store.selectedCardId).toBe('B')
    expect(store.selected?.card.id).toBe('B')
  })

  it('se o cartão selecionado deixou de existir, seleciona o primeiro', async () => {
    const store = await storeWith([withInvoice('A'), withInvoice('B')])
    store.select('B')
    service.listWithInvoices.mockResolvedValue([withInvoice('C'), withInvoice('A')])

    await store.load()

    expect(store.selectedCardId).toBe('C')
  })

  it('lista vazia deixa a seleção nula', async () => {
    const store = await storeWith([withInvoice('A')])
    service.listWithInvoices.mockResolvedValue([])

    await store.load()

    expect(store.selectedCardId).toBeNull()
    expect(store.selected).toBeNull()
  })

  it('selecionado faz fallback ao primeiro cartão quando o id é desconhecido', async () => {
    const store = await storeWith([withInvoice('A'), withInvoice('B')])

    store.select('inexistente')

    expect(store.selected?.card.id).toBe('A')
  })

  it('criar seleciona o cartão criado', async () => {
    service.create.mockResolvedValue(card('B'))
    const store = await storeWith([withInvoice('A'), withInvoice('B')])
    expect(store.selectedCardId).toBe('A')

    const ok = await store.create(CARD_PAYLOAD)

    expect(ok).toBe(true)
    expect(service.create).toHaveBeenCalledWith(CARD_PAYLOAD)
    expect(store.selectedCardId).toBe('B')
    expect(store.selected?.card.id).toBe('B')
    expect(store.saving).toBe(false)
  })
})

describe('getters', () => {
  it('totalInvoices soma as faturas e ignora cartões sem fatura', async () => {
    const store = await storeWith([
      withInvoice('A', { invoice: { total: 100 } }),
      withInvoice('B', { invoice: null }),
      withInvoice('C', { invoice: { total: 250.5 } }),
    ])

    expect(store.totalInvoices).toBe(350.5)
  })

  it('totalLimit soma só os cartões ativos', async () => {
    const store = await storeWith([
      withInvoice('A', { card: { limit: 1000, active: true } }),
      withInvoice('B', { card: { limit: 500, active: false } }),
      withInvoice('C', { card: { limit: 2000, active: true } }),
    ])

    expect(store.totalLimit).toBe(3000)
  })

  it('openInvoices conta faturas existentes que não estão PAGA', async () => {
    const store = await storeWith([
      withInvoice('A', { invoice: { status: 'ABERTA' } }),
      withInvoice('B', { invoice: { status: 'PAGA' } }),
      withInvoice('C', { invoice: null }),
      withInvoice('D', { invoice: { status: 'ATRASADA' } }),
      withInvoice('E', { invoice: { status: 'FECHADA' } }),
    ])

    expect(store.openInvoices).toBe(3)
  })

  it('vazio é verdadeiro sem cartões e sem loading', () => {
    expect(useCreditCardStore().isEmpty).toBe(true)
  })

  it('vazio é falso com cartões', async () => {
    const store = await storeWith([withInvoice('A')])

    expect(store.isEmpty).toBe(false)
  })

  it('vazio é falso enquanto carrega', async () => {
    let finish!: () => void
    service.listWithInvoices.mockReturnValue(new Promise((resolve) => (finish = () => resolve([]))))
    const store = useCreditCardStore()

    const promessa = store.load()
    expect(store.isEmpty).toBe(false)
    finish()
    await promessa

    expect(store.isEmpty).toBe(true)
  })

  it('cardOptions lista só os ativos com o rótulo "Nome ····1234"', async () => {
    const store = await storeWith([
      withInvoice('A', { card: { name: 'Nubank', lastDigits: '4821', active: true } }),
      withInvoice('B', { card: { name: 'Inter', lastDigits: '2277', active: false } }),
      withInvoice('C', { card: { name: 'Itaú', lastDigits: '9013', active: true } }),
    ])

    expect(store.cardOptions).toEqual([
      { label: 'Nubank ····4821', value: 'A' },
      { label: 'Itaú ····9013', value: 'C' },
    ])
  })

  it('byId devolve o cartão ou null', async () => {
    const store = await storeWith([withInvoice('A', { card: { name: 'Nubank' } })])

    expect(store.byId('A')?.name).toBe('Nubank')
    expect(store.byId('inexistente')).toBeNull()
    expect(store.byId(null)).toBeNull()
    expect(store.byId(undefined)).toBeNull()
  })
})

describe('filtros', () => {
  const transactions = [
    transaction('t1', { description: 'Supermercado', notes: 'compra do mês', type: 'ALIMENTACAO', categoryId: 'c1' }),
    transaction('t2', { description: 'Café', type: 'ALIMENTACAO', categoryId: 'c2' }),
    transaction('t3', { description: 'Uber', type: 'TRANSPORTE', categoryId: 'c1' }),
    transaction('t4', { description: 'Cinema', notes: 'Sessão', type: 'LAZER', categoryId: 'c2' }),
  ]

  const ids = (list: CardTransaction[]) => list.map((t) => t.id)

  async function storeWithTransactions() {
    return storeWith([withInvoice('A', { invoice: { transactions } }), withInvoice('B')])
  }

  it('sem filtros devolve todas as transações da fatura selecionada', async () => {
    const store = await storeWithTransactions()

    expect(ids(store.filteredTransactions)).toEqual(['t1', 't2', 't3', 't4'])
  })

  it('só considera o cartão selecionado', async () => {
    const store = await storeWithTransactions()

    store.select('B')

    expect(store.filteredTransactions).toEqual([])
  })

  it('sem cartões ou sem fatura devolve lista vazia', async () => {
    expect(useCreditCardStore().filteredTransactions).toEqual([])

    const store = await storeWith([withInvoice('A', { invoice: null })])
    expect(store.filteredTransactions).toEqual([])
  })

  it('busca sem diferenciar acento nem caixa', async () => {
    const store = await storeWithTransactions()

    store.setSearch('CAFE')

    expect(ids(store.filteredTransactions)).toEqual(['t2'])
  })

  it('busca também na observação', async () => {
    const store = await storeWithTransactions()

    store.setSearch('sessao')
    expect(ids(store.filteredTransactions)).toEqual(['t4'])

    store.setSearch('do MES')
    expect(ids(store.filteredTransactions)).toEqual(['t1'])
  })

  it('filtra por categoria', async () => {
    const store = await storeWithTransactions()

    store.filterByCategory('c1')

    expect(ids(store.filteredTransactions)).toEqual(['t1', 't3'])
  })

  it('filtra por tipo', async () => {
    const store = await storeWithTransactions()

    store.filterByType('ALIMENTACAO')

    expect(ids(store.filteredTransactions)).toEqual(['t1', 't2'])
  })

  it('combina categoria, tipo e busca', async () => {
    const store = await storeWithTransactions()

    store.filterByCategory('c2')
    store.filterByType('ALIMENTACAO')
    expect(ids(store.filteredTransactions)).toEqual(['t2'])

    store.setSearch('uber')
    expect(store.filteredTransactions).toEqual([])
  })

  it('filtrar não recarrega os cartões (é client-side)', async () => {
    const store = await storeWithTransactions()
    service.listWithInvoices.mockClear()

    store.filterByCategory('c1')
    store.filterByType('LAZER')
    store.setSearch('x')
    store.clearFilters()

    expect(service.listWithInvoices).not.toHaveBeenCalled()
  })

  it('hasActiveFilter reage a categoria, tipo e busca, ignorando espaços', () => {
    const store = useCreditCardStore()
    expect(store.hasActiveFilter).toBe(false)

    store.setSearch('   ')
    expect(store.hasActiveFilter).toBe(false)

    store.setSearch('abc')
    expect(store.hasActiveFilter).toBe(true)
    store.setSearch('')

    store.filterByCategory('c1')
    expect(store.hasActiveFilter).toBe(true)
    store.filterByCategory(null)

    store.filterByType('LAZER')
    expect(store.hasActiveFilter).toBe(true)
  })

  it('clearFilters zera categoria, tipo e busca', async () => {
    const store = await storeWithTransactions()
    store.filterByCategory('c1')
    store.filterByType('LAZER')
    store.setSearch('abc')

    store.clearFilters()

    expect(store.categoryId).toBeNull()
    expect(store.type).toBeNull()
    expect(store.search).toBe('')
    expect(store.hasActiveFilter).toBe(false)
    expect(ids(store.filteredTransactions)).toEqual(['t1', 't2', 't3', 't4'])
  })
})

describe('ações', () => {
  const actions = [
    {
      name: 'update',
      call: (store: ReturnType<typeof useCreditCardStore>) => store.update('A', CARD_PAYLOAD),
      method: () => service.update,
      args: ['A', CARD_PAYLOAD],
      fallback: 'Não foi possível atualizar o cartão.',
    },
    {
      name: 'remove',
      call: (store: ReturnType<typeof useCreditCardStore>) => store.remove('A'),
      method: () => service.remove,
      args: ['A'],
      fallback: 'Não foi possível excluir o cartão.',
    },
    {
      name: 'updateTransaction',
      call: (store: ReturnType<typeof useCreditCardStore>) => store.updateTransaction('A', 't1', transactionPayload()),
      method: () => service.updateTransaction,
      args: ['A', 't1', transactionPayload()],
      fallback: 'Não foi possível atualizar o débito.',
    },
    {
      name: 'removeTransaction',
      call: (store: ReturnType<typeof useCreditCardStore>) => store.removeTransaction('A', 't1'),
      method: () => service.removeTransaction,
      args: ['A', 't1'],
      fallback: 'Não foi possível excluir o débito.',
    },
    {
      name: 'payInvoice',
      call: (store: ReturnType<typeof useCreditCardStore>) => store.payInvoice('fat_A'),
      method: () => service.payInvoice,
      args: ['fat_A'],
      fallback: 'Não foi possível registrar o pagamento.',
    },
    {
      name: 'create',
      call: (store: ReturnType<typeof useCreditCardStore>) => store.create(CARD_PAYLOAD),
      method: () => service.create,
      args: [CARD_PAYLOAD],
      fallback: 'Não foi possível salvar o cartão.',
    },
  ]

  it.each(actions)('$nome: sucesso retorna true, chama o service e recarrega', async ({ call, method, args }) => {
    const store = useCreditCardStore()

    const ok = await call(store)

    expect(ok).toBe(true)
    expect(method()).toHaveBeenCalledWith(...args)
    expect(service.listWithInvoices).toHaveBeenCalledTimes(1)
    expect(store.saving).toBe(false)
  })

  it.each(actions)('$nome: falha retorna false, preenche erro e não recarrega', async ({ call, method }) => {
    method().mockRejectedValue(new Error('Falha específica'))
    const store = useCreditCardStore()

    const ok = await call(store)

    expect(ok).toBe(false)
    expect(store.error).toBe('Falha específica')
    expect(service.listWithInvoices).not.toHaveBeenCalled()
    expect(store.saving).toBe(false)
  })

  it.each(actions)('$nome: falha sem mensagem aproveitável usa o texto padrão', async ({ call, method, fallback }) => {
    method().mockRejectedValue('quebrou')
    const store = useCreditCardStore()

    await call(store)

    expect(store.error).toBe(fallback)
  })

  it('mantém salvando verdadeiro enquanto a ação está em andamento', async () => {
    let finish!: () => void
    service.payInvoice.mockReturnValue(new Promise((resolve) => (finish = () => resolve(undefined))))
    const store = useCreditCardStore()

    const promessa = store.payInvoice('fat_A')
    expect(store.saving).toBe(true)
    finish()
    await promessa

    expect(store.saving).toBe(false)
  })
})
