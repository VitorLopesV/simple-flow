import { describe, expect, it } from 'vitest'

import {
  mapPage,
  toArea,
  toAreaPayloadDto,
  toCardTransactionPayloadDto,
  toCreditCardPayloadDto,
  toCreditCardWithInvoice,
  toDashboardSummary,
  toExpense,
  toExpensePayloadDto,
  toExpenseSummary,
  toIncome,
  toNavigationLimits,
  toIncomePayloadDto,
  toIncomeSummary,
  toLoginDto,
  toProfileDto,
  toRegisterDto,
  toRoutineItem,
  toRoutinePayloadDto,
  toSprintScoreboard,
  toSprintView,
  toSuperTask,
  toSuperTaskEditDto,
  toSuperTaskPayloadDto,
  toTask,
  toTaskEditDto,
  toTaskPayloadDto,
  toUserSession,
} from '@/services/mappers'
import type { DashboardSummaryDto, ExpenseDto, IncomeDto, RoutineItemDto, SuperTaskDto } from '@/types/dto'

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
  serieId: 'ser_1',
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

describe('competências', () => {
  it('converte os limites de navegação de YYYY-MM para período', () => {
    expect(toNavigationLimits({ primeiroMes: '2026-01', ultimoMes: '2026-10' })).toEqual({
      firstMonth: { month: 1, year: 2026 },
      lastMonth: { month: 10, year: 2026 },
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
      seriesId: 'ser_1',
    })
  })

  it('ida e volta do payload preserva todos os campos editáveis', () => {
    const { id: _id, criadoEm: _criadoEm, atualizadoEm: _atualizadoEm, serieId: _s, ...payloadDto } = INCOME_DTO
    const { id: _i, createdAt: _c, updatedAt: _u, seriesId: _si, ...payload } = toIncome(INCOME_DTO)

    expect(toIncomePayloadDto(payload)).toEqual(payloadDto)
  })

  it('a série vem da API mas nunca vai no payload (é gerida pelo backend)', () => {
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = toIncome(INCOME_DTO)

    expect(rest.seriesId).toBe('ser_1')
    expect(toIncomePayloadDto(rest)).not.toHaveProperty('serieId')
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
          action: 'ADICIONADO',
          occurredAt: undefined,
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

describe('áreas', () => {
  it('converte a área da API', () => {
    expect(
      toArea({ id: 'are_1', nome: 'Rotina', cor: '#6366f1', sistema: true, criadoEm: '2026-01-01T00:00:00.000Z' }),
    ).toEqual({ id: 'are_1', name: 'Rotina', color: '#6366f1', system: true, createdAt: '2026-01-01T00:00:00.000Z' })
  })

  it('converte o payload para o formato da API', () => {
    expect(toAreaPayloadDto({ name: 'Trabalho', color: '#3b82f6' })).toEqual({ nome: 'Trabalho', cor: '#3b82f6' })
  })
})

describe('tarefas', () => {
  const DTO = {
    id: 'tar_1',
    areaId: 'are_2',
    titulo: 'Pintar a casa',
    dia: '2026-12-01',
    hora: '09:30',
    tempoEstimado: 120 as const,
    dificuldade: 'MEDIA' as const,
    prioridade: 'ALTA' as const,
    notas: 'Comprar tinta',
    sprintId: 'spr_1',
    concluidaEm: null,
    concluida: false,
    atrasada: false,
    arquivada: false,
    arquivadaEm: null,
    criadoEm: '2026-11-01T10:00:00.000Z',
  }

  it('converte a tarefa da API', () => {
    expect(toTask(DTO)).toEqual({
      id: 'tar_1',
      areaId: 'are_2',
      title: 'Pintar a casa',
      day: '2026-12-01',
      time: '09:30',
      estimateMinutes: 120,
      difficulty: 'MEDIA',
      priority: 'ALTA',
      notes: 'Comprar tinta',
      sprintId: 'spr_1',
      done: false,
      completedAt: null,
      late: false,
      superTaskId: null,
      archived: false,
      archivedAt: null,
      createdAt: '2026-11-01T10:00:00.000Z',
    })
  })

  it('lê a conclusão definitiva e o atraso devolvidos pela API', () => {
    expect(
      toTask({ ...DTO, concluida: true, concluidaEm: '2026-12-01T15:00:00.000Z', atrasada: true }),
    ).toMatchObject({ done: true, completedAt: '2026-12-01T15:00:00.000Z', late: true })
  })

  it('lê a Super task pai da filha', () => {
    expect(toTask({ ...DTO, superTaskId: 'sup_1' })).toMatchObject({ superTaskId: 'sup_1' })
  })

  it('trata a ausência de superTaskId como tarefa avulsa', () => {
    const { superTaskId: _ignored, ...withoutParent } = { ...DTO, superTaskId: 'sup_1' }
    expect(toTask(withoutParent)).toMatchObject({ superTaskId: null })
  })

  it('preserva os campos vazios como null', () => {
    const dto = { ...DTO, dia: null, hora: null, tempoEstimado: null, dificuldade: null, prioridade: null, notas: null }
    expect(toTask(dto)).toMatchObject({
      day: null,
      time: null,
      estimateMinutes: null,
      difficulty: null,
      priority: null,
      notes: null,
    })
  })

  it('converte a edição para o formato da API, sem a área', () => {
    expect(
      toTaskEditDto({
        title: 'Pintar a casa',
        day: '2026-12-01',
        time: '09:30',
        estimateMinutes: 120,
        difficulty: 'MEDIA',
        priority: 'ALTA',
        notes: 'Comprar tinta',
      }),
    ).toEqual({
      titulo: 'Pintar a casa',
      dia: '2026-12-01',
      hora: '09:30',
      tempoEstimado: 120,
      dificuldade: 'MEDIA',
      prioridade: 'ALTA',
      notas: 'Comprar tinta',
    })
  })

  it('converte o payload de criação incluindo a área', () => {
    expect(
      toTaskPayloadDto({
        areaId: 'are_2',
        title: 'Ligar',
        day: null,
        time: null,
        estimateMinutes: null,
        difficulty: null,
        priority: null,
        notes: null,
      }),
    ).toEqual({
      areaId: 'are_2',
      titulo: 'Ligar',
      dia: null,
      hora: null,
      tempoEstimado: null,
      dificuldade: null,
      prioridade: null,
      notas: null,
    })
  })
})

describe('mappers de rotina', () => {
  const WEEKLY_DTO: RoutineItemDto = {
    id: 'rot_1',
    areaId: 'are_1',
    nome: 'Tomar remédio',
    repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1, 3, 5] },
    vezes: [{ hora: '08:00' }, { hora: null }],
    criadoEm: '2026-11-16T10:00:00.000Z',
  }

  it('converte o item de dias da semana da API', () => {
    expect(toRoutineItem(WEEKLY_DTO)).toEqual({
      id: 'rot_1',
      areaId: 'are_1',
      name: 'Tomar remédio',
      repeat: { mode: 'DIAS_DA_SEMANA', days: [1, 3, 5] },
      times: [{ time: '08:00' }, { time: null }],
      createdAt: '2026-11-16T10:00:00.000Z',
    })
  })

  it('converte o item de "a cada N dias" da API', () => {
    const dto: RoutineItemDto = {
      ...WEEKLY_DTO,
      repeticao: { modo: 'A_CADA_N_DIAS', intervalo: 3, dataInicial: '2026-11-16' },
      vezes: [{ hora: null }],
    }
    expect(toRoutineItem(dto).repeat).toEqual({ mode: 'A_CADA_N_DIAS', interval: 3, startDate: '2026-11-16' })
  })

  it('mantém hora null na ida e na volta', () => {
    const item = toRoutineItem({ ...WEEKLY_DTO, vezes: [{ hora: null }] })
    expect(item.times).toEqual([{ time: null }])
    expect(toRoutinePayloadDto(item).vezes).toEqual([{ hora: null }])
  })

  it('trata hora ausente como null', () => {
    const dto = { ...WEEKLY_DTO, vezes: [{} as { hora: string | null }] }
    expect(toRoutineItem(dto).times).toEqual([{ time: null }])
  })

  it('converte o payload de dias da semana para a API, sem areaId', () => {
    expect(
      toRoutinePayloadDto({
        name: 'Tomar remédio',
        repeat: { mode: 'DIAS_DA_SEMANA', days: [1, 3, 5] },
        times: [{ time: '08:00' }, { time: null }],
      }),
    ).toEqual({
      nome: 'Tomar remédio',
      repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1, 3, 5] },
      vezes: [{ hora: '08:00' }, { hora: null }],
    })
  })

  it('converte o payload de "a cada N dias" para a API', () => {
    expect(
      toRoutinePayloadDto({
        name: 'Regar plantas',
        repeat: { mode: 'A_CADA_N_DIAS', interval: 3, startDate: '2026-11-16' },
        times: [{ time: null }],
      }),
    ).toEqual({
      nome: 'Regar plantas',
      repeticao: { modo: 'A_CADA_N_DIAS', intervalo: 3, dataInicial: '2026-11-16' },
      vezes: [{ hora: null }],
    })
  })
})

describe('sprint', () => {
  it('converte o sprint com ocorrências e lembretes', () => {
    const occurrence = {
      id: 'o1',
      itemId: 'r1',
      nome: 'Treinar',
      data: '2026-11-16',
      hora: '07:00',
      indice: 0,
      ordem: 1,
      concluidaEm: null,
    }
    const view = toSprintView({
      sprint: {
        id: 'spr_1',
        inicio: '2026-11-16',
        fim: '2026-11-20',
        situacao: 'ABERTO',
        rotinaGeradaEm: '2026-11-16T03:00:00.000Z',
        criadoEm: '2026-11-15T00:00:00.000Z',
      },
      iniciado: true,
      previa: false,
      ocorrencias: [occurrence],
      lembretes: [{ ...occurrence, id: null, itemId: null, data: '2026-11-21', hora: null }],
    })

    expect(view.sprint).toEqual({
      id: 'spr_1',
      startDate: '2026-11-16',
      endDate: '2026-11-20',
      status: 'ABERTO',
      startedRoutineAt: '2026-11-16T03:00:00.000Z',
      createdAt: '2026-11-15T00:00:00.000Z',
    })
    expect(view).toMatchObject({ started: true, preview: false })
    expect(view.occurrences[0]).toEqual({
      id: 'o1',
      itemId: 'r1',
      name: 'Treinar',
      date: '2026-11-16',
      time: '07:00',
      index: 0,
      order: 1,
      completedAt: null,
    })
    expect(view.reminders[0]).toMatchObject({ id: null, itemId: null, date: '2026-11-21', time: null })
  })

  it('converte o placar mantendo o bônus vindo da API (não o percentual)', () => {
    const result = toSprintScoreboard({
      sprintId: 'spr_1',
      inicio: '2026-11-16',
      fim: '2026-11-20',
      iniciado: true,
      previa: false,
      placar: {
        total: 5000,
        feitos: 4498,
        percentual: 90,
        bonus: false,
        rotina: { diasComRotina: 5, diasCumpridos: 5, pontosPorDia: 40, total: 200, feitos: 200 },
        tarefas: { quantidade: 10, concluidas: 9, total: 4800, feitos: 4298 },
      },
    })

    expect(result).toEqual({
      sprintId: 'spr_1',
      startDate: '2026-11-16',
      endDate: '2026-11-20',
      started: true,
      preview: false,
      scoreboard: {
        total: 5000,
        done: 4498,
        percentage: 90,
        bonus: false,
        routine: { daysWithRoutine: 5, daysCompleted: 5, pointsPerDay: 40, total: 200, done: 200 },
        tasks: { count: 10, completed: 9, total: 4800, done: 4298 },
      },
    })
  })
})

describe('super task', () => {
  const CHILD = {
    id: 'tar_1',
    areaId: 'are_2',
    titulo: 'Comprar tinta',
    dia: null,
    hora: null,
    tempoEstimado: null,
    dificuldade: null,
    prioridade: null,
    notas: null,
    sprintId: null,
    concluidaEm: '2026-11-10T10:00:00.000Z',
    concluida: true,
    atrasada: false,
    superTaskId: 'sup_1',
    arquivada: false,
    arquivadaEm: null,
    criadoEm: '2026-11-01T10:00:00.000Z',
  }
  const DTO: SuperTaskDto = {
    id: 'sup_1',
    areaId: 'are_2',
    titulo: 'Reforma',
    notas: 'Sala e cozinha',
    dataTermino: '2026-12-20',
    concluidaEm: null,
    concluida: false,
    arquivada: false,
    arquivadaEm: null,
    criadoEm: '2026-11-01T09:00:00.000Z',
    filhas: [CHILD],
    totalFilhas: 2,
    filhasConcluidas: 1,
    progresso: 50,
    estado: 'EM_ANDAMENTO',
    vencida: false,
    podeConcluir: false,
  }

  it('converte a Super task detalhada da API, com as filhas', () => {
    const superTask = toSuperTask(DTO)
    expect(superTask).toMatchObject({
      id: 'sup_1',
      areaId: 'are_2',
      title: 'Reforma',
      notes: 'Sala e cozinha',
      endDate: '2026-12-20',
      completedAt: null,
      done: false,
      archived: false,
      totalTasks: 2,
      completedTasks: 1,
      progress: 50,
      state: 'EM_ANDAMENTO',
      overdue: false,
      canComplete: false,
    })
    expect(superTask.tasks).toHaveLength(1)
    expect(superTask.tasks[0]).toMatchObject({ id: 'tar_1', superTaskId: 'sup_1', done: true })
  })

  it('lê a Super task concluída, vencida e reaberta em 100%', () => {
    expect(toSuperTask({ ...DTO, concluida: true, concluidaEm: '2026-11-11T00:00:00.000Z', estado: 'CONCLUIDA' })).toMatchObject({
      done: true,
      state: 'CONCLUIDA',
    })
    expect(toSuperTask({ ...DTO, vencida: true })).toMatchObject({ overdue: true })
    expect(toSuperTask({ ...DTO, progresso: 100, podeConcluir: true })).toMatchObject({ progress: 100, canComplete: true })
  })

  it('monta o payload e a edição no formato da API', () => {
    const edit = { title: 'Reforma', notes: null, endDate: '2026-12-20' }
    expect(toSuperTaskEditDto(edit)).toEqual({ titulo: 'Reforma', notas: null, dataTermino: '2026-12-20' })
    expect(toSuperTaskPayloadDto({ ...edit, areaId: 'are_2' })).toEqual({
      titulo: 'Reforma',
      notas: null,
      dataTermino: '2026-12-20',
      areaId: 'are_2',
    })
  })
})
