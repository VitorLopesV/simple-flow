import { describe, expect, it } from 'vitest'

import {
  mapPage,
  toCardTransactionPayloadDto,
  toCreditCardPayloadDto,
  toCreditCardWithInvoice,
  toDashboardSummary,
  toExpense,
  toExpensePayloadDto,
  toExpenseSummary,
  toIncome,
  toIncomePayloadDto,
  toIncomeSummary,
  toLoginDto,
  toProfileDto,
  toRegisterDto,
  toUserSession,
} from '@/services/mappers'
import type { DashboardSummaryDto, ExpenseDto, IncomeDto } from '@/types/dto'

const INCOME_DTO: IncomeDto = {
  id: 'ent_1',
  descricao: 'Salário',
  valor: 5000,
  data: '2026-08-05',
  categoriaId: 'cat_1',
  tipo: 'SALARIO',
  recorrente: true,
  observacao: 'Crédito em conta',
  criadoEm: '2026-08-01T00:00:00.000Z',
  atualizadoEm: '2026-08-02T00:00:00.000Z',
  origemRecorrenciaId: 'ent_0',
}

const EXPENSE_DTO: ExpenseDto = {
  id: 'sai_1',
  descricao: 'Aluguel',
  valor: 1900,
  data: '2026-08-10',
  categoriaId: 'cat_2',
  tipo: 'CONTA',
  status: 'PAGO',
  vencimento: '2026-08-10',
  pagoEm: '2026-08-09',
  formaPagamento: 'PIX',
  cartaoId: null,
  recorrente: true,
  observacao: 'Apartamento',
  criadoEm: '2026-08-01T00:00:00.000Z',
  atualizadoEm: '2026-08-02T00:00:00.000Z',
  automatica: false,
}

describe('auth', () => {
  it('converte a sessão da API, com o usuário aninhado', () => {
    expect(
      toUserSession({
        usuario: { id: 'u1', email: 'a@b.com', nome: 'Ana', telefone: '11999998888', fotoUrl: null },
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 3600,
      }),
    ).toEqual({
      user: { id: 'u1', email: 'a@b.com', name: 'Ana', phone: '11999998888', photoUrl: null },
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 3600,
    })
  })

  it('envia login, registro e perfil com os campos da API', () => {
    expect(toLoginDto({ email: 'a@b.com', password: '123456' })).toEqual({ email: 'a@b.com', senha: '123456' })
    expect(toRegisterDto({ email: 'a@b.com', password: '123456', name: 'Ana' })).toEqual({
      email: 'a@b.com',
      senha: '123456',
      nome: 'Ana',
    })
    expect(toProfileDto({ name: 'Ana', email: 'a@b.com', phone: null, photoUrl: 'data:x' })).toEqual({
      nome: 'Ana',
      email: 'a@b.com',
      telefone: null,
      fotoUrl: 'data:x',
    })
  })
})

describe('entradas', () => {
  it('converte a entrada da API para o domínio', () => {
    expect(toIncome(INCOME_DTO)).toEqual({
      id: 'ent_1',
      description: 'Salário',
      amount: 5000,
      date: '2026-08-05',
      categoryId: 'cat_1',
      type: 'SALARIO',
      recurring: true,
      notes: 'Crédito em conta',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
      recurrenceOriginId: 'ent_0',
    })
  })

  it('ida e volta do payload preserva todos os campos editáveis', () => {
    const { id: _id, criadoEm: _criadoEm, atualizadoEm: _atualizadoEm, ...payloadDto } = INCOME_DTO
    const { id: _i, createdAt: _c, updatedAt: _u, ...payload } = toIncome(INCOME_DTO)

    expect(toIncomePayloadDto(payload)).toEqual(payloadDto)
  })

  it('converte o resumo, com as categorias', () => {
    expect(
      toIncomeSummary({
        total: 100,
        quantidade: 2,
        media: 50,
        totalMesAnterior: 80,
        porCategoria: [{ categoriaId: 'cat_1', nome: 'Salário', cor: '#10b981', total: 100 }],
      }),
    ).toEqual({
      total: 100,
      count: 2,
      average: 50,
      previousMonthTotal: 80,
      byCategory: [{ categoryId: 'cat_1', name: 'Salário', color: '#10b981', total: 100 }],
    })
  })
})

describe('saídas', () => {
  it('converte a saída da API para o domínio', () => {
    expect(toExpense(EXPENSE_DTO)).toEqual({
      id: 'sai_1',
      description: 'Aluguel',
      amount: 1900,
      date: '2026-08-10',
      categoryId: 'cat_2',
      type: 'CONTA',
      status: 'PAGO',
      dueDate: '2026-08-10',
      paidAt: '2026-08-09',
      paymentMethod: 'PIX',
      cardId: null,
      recurring: true,
      notes: 'Apartamento',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
      automatic: false,
    })
  })

  it('ida e volta do payload preserva todos os campos editáveis', () => {
    const { id: _id, criadoEm: _criadoEm, atualizadoEm: _atualizadoEm, ...payloadDto } = EXPENSE_DTO
    const { id: _i, createdAt: _c, updatedAt: _u, ...payload } = toExpense(EXPENSE_DTO)

    expect(toExpensePayloadDto(payload)).toEqual(payloadDto)
  })

  it('trata backend sem porTipo como lista vazia', () => {
    const summary = toExpenseSummary({
      total: 0,
      quantidade: 0,
      media: 0,
      totalPago: 0,
      totalPendente: 0,
      totalMesAnterior: 0,
      porCategoria: [],
    } as unknown as Parameters<typeof toExpenseSummary>[0])

    expect(summary.byType).toEqual([])
  })
})

describe('cartões', () => {
  it('converte cartão, fatura e transações', () => {
    const result = toCreditCardWithInvoice({
      cartao: {
        id: 'car_1',
        nome: 'Nubank',
        bandeira: 'MASTERCARD',
        ultimosDigitos: '1234',
        limite: 1000,
        diaFechamento: 20,
        diaVencimento: 27,
        cor: '#8b5cf6',
        ativo: true,
        criadoEm: '2026-01-01T00:00:00.000Z',
      },
      fatura: {
        id: 'fat_1',
        cartaoId: 'car_1',
        competencia: '2026-08',
        fechamento: '2026-08-20',
        vencimento: '2026-08-27',
        total: 90,
        status: 'ABERTA',
        pagoEm: null,
        transacoes: [
          {
            id: 'trc_1',
            cartaoId: 'car_1',
            faturaId: 'fat_1',
            descricao: 'Mercado',
            valor: 90,
            data: '2026-08-15',
            categoriaId: 'cat_2',
            tipo: 'ALIMENTACAO',
            parcelaAtual: 1,
            totalParcelas: 3,
            recorrente: false,
            observacao: null,
            criadoEm: '2026-08-15T00:00:00.000Z',
            atualizadoEm: '2026-08-15T00:00:00.000Z',
          },
        ],
      },
      usoLimite: 9,
    })

    expect(result.card).toMatchObject({ name: 'Nubank', brand: 'MASTERCARD', lastDigits: '1234', closingDay: 20, dueDay: 27 })
    expect(result.invoice).toMatchObject({ cardId: 'car_1', referenceMonth: '2026-08', closingDate: '2026-08-20', dueDate: '2026-08-27' })
    expect(result.invoice?.transactions[0]).toMatchObject({
      invoiceId: 'fat_1',
      description: 'Mercado',
      amount: 90,
      installment: 1,
      totalInstallments: 3,
    })
    expect(result.limitUsage).toBe(9)
  })

  it('mantém fatura nula quando o cartão não tem fatura no mês', () => {
    const result = toCreditCardWithInvoice({
      cartao: {
        id: 'car_1',
        nome: 'Nubank',
        bandeira: 'VISA',
        ultimosDigitos: '1234',
        limite: 1000,
        diaFechamento: 20,
        diaVencimento: 27,
        cor: '#000000',
        ativo: true,
        criadoEm: '',
      },
      fatura: null,
      usoLimite: 0,
    })

    expect(result.invoice).toBeNull()
  })

  it('envia cartão e débito com os campos da API', () => {
    expect(
      toCreditCardPayloadDto({
        name: 'Nubank',
        brand: 'ELO',
        lastDigits: '4321',
        limit: 500,
        closingDay: 5,
        dueDay: 12,
        color: '#fff',
        active: false,
      }),
    ).toEqual({
      nome: 'Nubank',
      bandeira: 'ELO',
      ultimosDigitos: '4321',
      limite: 500,
      diaFechamento: 5,
      diaVencimento: 12,
      cor: '#fff',
      ativo: false,
    })

    expect(
      toCardTransactionPayloadDto({
        description: 'Uber',
        amount: 30,
        date: '2026-08-01',
        categoryId: 'cat_2',
        type: 'TRANSPORTE',
        installment: 1,
        totalInstallments: 1,
        recurring: false,
        notes: null,
      }),
    ).toEqual({
      descricao: 'Uber',
      valor: 30,
      data: '2026-08-01',
      categoriaId: 'cat_2',
      tipo: 'TRANSPORTE',
      parcelaAtual: 1,
      totalParcelas: 1,
      recorrente: false,
      observacao: null,
    })
  })
})

describe('dashboard', () => {
  const BASE: DashboardSummaryDto = {
    totalEntradas: 1000,
    totalSaidas: 400,
    saldo: 600,
    totalFaturas: 100,
    variacaoEntradas: 0.1,
    variacaoSaidas: -0.2,
    serieEntradas: [{ label: 'ago/26', valor: 1000 }],
    serieSaidas: [{ label: 'ago/26', valor: 400 }],
    gastosPorCategoria: [{ nome: 'Casa', cor: '#6366f1', total: 400 }],
    transacoesRecentes: [
      {
        id: 'e1',
        tipo: 'ENTRADA',
        descricao: 'Salário',
        valor: 1000,
        data: '2026-08-05',
        categoriaNome: 'Salário',
        categoriaCor: '#10b981',
      },
    ],
  }

  it('converte o resumo, incluindo séries e transações recentes', () => {
    const summary = toDashboardSummary({
      ...BASE,
      serieFaturas: [{ label: 'ago/26', valor: 100 }],
      entradasPorCategoria: [{ nome: 'Salário', cor: '#10b981', total: 1000 }],
      gastosCartoesPorTipo: [{ tipo: 'LAZER', total: 100 }],
      gastosCartoesPorCategoria: [{ nome: 'Casa', cor: '#6366f1', total: 100 }],
    })

    expect(summary).toEqual({
      totalIncome: 1000,
      totalExpenses: 400,
      balance: 600,
      totalInvoices: 100,
      incomeChange: 0.1,
      expenseChange: -0.2,
      incomeSeries: [{ label: 'ago/26', value: 1000 }],
      expenseSeries: [{ label: 'ago/26', value: 400 }],
      invoiceSeries: [{ label: 'ago/26', value: 100 }],
      expensesByCategory: [{ name: 'Casa', color: '#6366f1', total: 400 }],
      incomeByCategory: [{ name: 'Salário', color: '#10b981', total: 1000 }],
      cardExpensesByType: [{ type: 'LAZER', total: 100 }],
      cardExpensesByCategory: [{ name: 'Casa', color: '#6366f1', total: 100 }],
      recentTransactions: [
        {
          id: 'e1',
          movement: 'ENTRADA',
          description: 'Salário',
          amount: 1000,
          date: '2026-08-05',
          categoryName: 'Salário',
          categoryColor: '#10b981',
        },
      ],
    })
  })

  it('trata campos que um backend antigo não devolve', () => {
    const summary = toDashboardSummary(BASE)

    expect(summary.incomeByCategory).toEqual([])
    expect(summary.invoiceSeries).toBeUndefined()
    expect(summary.cardExpensesByType).toBeUndefined()
    expect(summary.cardExpensesByCategory).toBeUndefined()
  })
})

describe('mapPage', () => {
  it('converte só os itens, mantendo a paginação', () => {
    expect(
      mapPage({ items: [INCOME_DTO], page: 2, pageSize: 20, total: 21, totalPages: 2 }, toIncome),
    ).toEqual({ items: [toIncome(INCOME_DTO)], page: 2, pageSize: 20, total: 21, totalPages: 2 })
  })
})
