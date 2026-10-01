/**
 * Conversão entre o JSON da API (campos em português, ver `types/dto.ts`) e os
 * tipos de domínio em inglês usados pelo resto do frontend.
 *
 * Só os services chamam estas funções, e só na borda HTTP: o modo mock já guarda
 * os dados no formato de domínio. Quando o backend migrar o contrato, só este
 * arquivo e `types/dto.ts` mudam.
 */
import type { User, UserSession, LoginPayload, ProfilePayload, RegisterPayload } from '@/types/auth'
import type { Category } from '@/types/category'
import type { Paginated, SeriesPoint } from '@/types/common'
import type {
  CardTransaction,
  CardTransactionPayload,
  CreditCard,
  CreditCardPayload,
  CreditCardWithInvoice,
  DetailedInvoice,
} from '@/types/creditCard'
import type { CategoryTotal, DashboardSummary, RecentTransaction } from '@/types/dashboard'
import type {
  CardTransactionDto,
  CardTransactionPayloadDto,
  CategoryDto,
  CategoryTotalDto,
  CreditCardDto,
  CreditCardPayloadDto,
  CreditCardWithInvoiceDto,
  DashboardSummaryDto,
  DetailedInvoiceDto,
  ExpenseDto,
  ExpensePayloadDto,
  ExpenseSummaryDto,
  IncomeDto,
  IncomePayloadDto,
  IncomeSummaryDto,
  LoginDto,
  NavigationLimitsDto,
  ProfileDto,
  RecentTransactionDto,
  RegisterDto,
  SeriesPointDto,
  UserDto,
  UserSessionDto,
} from '@/types/dto'
import type { Expense, ExpensePayload, ExpenseSummary } from '@/types/expense'
import type { Income, IncomePayload, IncomeSummary } from '@/types/income'
import type { NavigationLimits } from '@/types/period'
import { fromReferenceMonth } from '@/utils/dateFormatter'

export function mapPage<TDto, T>(page: Paginated<TDto>, map: (dto: TDto) => T): Paginated<T> {
  return { ...page, items: page.items.map(map) }
}

function toSeriesPoint(dto: SeriesPointDto): SeriesPoint {
  return { label: dto.label, value: dto.valor }
}

function toCategoryTotal(dto: CategoryTotalDto): CategoryTotal {
  return { name: dto.nome, color: dto.cor, total: dto.total }
}

// ---------------------------------------------------------------------- auth

export function toUser(dto: UserDto): User {
  return {
    id: dto.id,
    email: dto.email,
    name: dto.nome,
    phone: dto.telefone,
    photoUrl: dto.fotoUrl,
  }
}

export function toUserSession(dto: UserSessionDto): UserSession {
  return {
    user: toUser(dto.usuario),
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken,
    expiresIn: dto.expiresIn,
  }
}

export function toLoginDto(payload: LoginPayload): LoginDto {
  return { email: payload.email, senha: payload.password }
}

export function toRegisterDto(payload: RegisterPayload): RegisterDto {
  return { email: payload.email, senha: payload.password, nome: payload.name }
}

export function toProfileDto(payload: ProfilePayload): ProfileDto {
  return {
    nome: payload.name,
    email: payload.email,
    telefone: payload.phone,
    fotoUrl: payload.photoUrl,
  }
}

// ---------------------------------------------------------------- categorias

export function toCategory(dto: CategoryDto): Category {
  return { id: dto.id, name: dto.nome, type: dto.tipo, movement: dto.movimento, color: dto.cor }
}

// ------------------------------------------------------------------ entradas

export function toIncome(dto: IncomeDto): Income {
  return {
    id: dto.id,
    description: dto.descricao,
    amount: dto.valor,
    date: dto.data,
    categoryId: dto.categoriaId,
    type: dto.tipo,
    recurring: dto.recorrente,
    notes: dto.observacao,
    seriesId: dto.serieId,
    createdAt: dto.criadoEm,
    updatedAt: dto.atualizadoEm,
  }
}

export function toIncomePayloadDto(payload: IncomePayload): IncomePayloadDto {
  return {
    descricao: payload.description,
    valor: payload.amount,
    data: payload.date,
    categoriaId: payload.categoryId,
    tipo: payload.type,
    recorrente: payload.recurring,
    observacao: payload.notes,
  }
}

export function toIncomeSummary(dto: IncomeSummaryDto): IncomeSummary {
  return {
    total: dto.total,
    count: dto.quantidade,
    average: dto.media,
    previousMonthTotal: dto.totalMesAnterior,
    byCategory: dto.porCategoria.map((item) => ({
      categoryId: item.categoriaId,
      ...toCategoryTotal(item),
    })),
  }
}

// -------------------------------------------------------------------- saídas

export function toExpense(dto: ExpenseDto): Expense {
  return {
    id: dto.id,
    description: dto.descricao,
    amount: dto.valor,
    date: dto.data,
    categoryId: dto.categoriaId,
    type: dto.tipo,
    status: dto.status,
    dueDate: dto.vencimento,
    paidAt: dto.pagoEm,
    paymentMethod: dto.formaPagamento,
    cardId: dto.cartaoId,
    recurring: dto.recorrente,
    notes: dto.observacao,
    createdAt: dto.criadoEm,
    updatedAt: dto.atualizadoEm,
    automatic: dto.automatica,
    seriesId: dto.serieId,
  }
}

export function toExpensePayloadDto(payload: ExpensePayload): ExpensePayloadDto {
  return {
    descricao: payload.description,
    valor: payload.amount,
    data: payload.date,
    categoriaId: payload.categoryId,
    tipo: payload.type,
    status: payload.status,
    vencimento: payload.dueDate,
    pagoEm: payload.paidAt,
    formaPagamento: payload.paymentMethod,
    cartaoId: payload.cardId,
    recorrente: payload.recurring,
    observacao: payload.notes,
    automatica: payload.automatic,
  }
}

export function toExpenseSummary(dto: ExpenseSummaryDto): ExpenseSummary {
  return {
    total: dto.total,
    count: dto.quantidade,
    average: dto.media,
    paidTotal: dto.totalPago,
    pendingTotal: dto.totalPendente,
    previousMonthTotal: dto.totalMesAnterior,
    byCategory: dto.porCategoria.map((item) => ({
      categoryId: item.categoriaId,
      ...toCategoryTotal(item),
    })),
    // `?? []` cobre um backend que ainda não devolva `porTipo`.
    byType: (dto.porTipo ?? []).map((item) => ({ type: item.tipo, total: item.total })),
  }
}

// ------------------------------------------------------------------- cartões

export function toCreditCard(dto: CreditCardDto): CreditCard {
  return {
    id: dto.id,
    name: dto.nome,
    brand: dto.bandeira,
    lastDigits: dto.ultimosDigitos,
    limit: dto.limite,
    closingDay: dto.diaFechamento,
    dueDay: dto.diaVencimento,
    color: dto.cor,
    active: dto.ativo,
    createdAt: dto.criadoEm,
  }
}

export function toCreditCardPayloadDto(payload: CreditCardPayload): CreditCardPayloadDto {
  return {
    nome: payload.name,
    bandeira: payload.brand,
    ultimosDigitos: payload.lastDigits,
    limite: payload.limit,
    diaFechamento: payload.closingDay,
    diaVencimento: payload.dueDay,
    cor: payload.color,
    ativo: payload.active,
  }
}

export function toCardTransaction(dto: CardTransactionDto): CardTransaction {
  return {
    id: dto.id,
    cardId: dto.cartaoId,
    invoiceId: dto.faturaId,
    description: dto.descricao,
    amount: dto.valor,
    date: dto.data,
    categoryId: dto.categoriaId,
    type: dto.tipo,
    installment: dto.parcelaAtual,
    totalInstallments: dto.totalParcelas,
    recurring: dto.recorrente,
    notes: dto.observacao,
    seriesId: dto.serieId,
    createdAt: dto.criadoEm,
    updatedAt: dto.atualizadoEm,
  }
}

export function toCardTransactionPayloadDto(
  payload: CardTransactionPayload,
): CardTransactionPayloadDto {
  return {
    descricao: payload.description,
    valor: payload.amount,
    data: payload.date,
    categoriaId: payload.categoryId,
    tipo: payload.type,
    parcelaAtual: payload.installment,
    totalParcelas: payload.totalInstallments,
    recorrente: payload.recurring,
    observacao: payload.notes,
  }
}

export function toDetailedInvoice(dto: DetailedInvoiceDto): DetailedInvoice {
  return {
    id: dto.id,
    cardId: dto.cartaoId,
    referenceMonth: dto.competencia,
    closingDate: dto.fechamento,
    dueDate: dto.vencimento,
    total: dto.total,
    status: dto.status,
    paidAt: dto.pagoEm,
    transactions: dto.transacoes.map(toCardTransaction),
  }
}

export function toCreditCardWithInvoice(dto: CreditCardWithInvoiceDto): CreditCardWithInvoice {
  return {
    card: toCreditCard(dto.cartao),
    invoice: dto.fatura ? toDetailedInvoice(dto.fatura) : null,
    limitUsage: dto.usoLimite,
  }
}

// -------------------------------------------------------------- competências

export function toNavigationLimits(dto: NavigationLimitsDto): NavigationLimits {
  return {
    firstMonth: fromReferenceMonth(dto.primeiroMes),
    lastMonth: fromReferenceMonth(dto.ultimoMes),
  }
}

// ----------------------------------------------------------------- dashboard

function toRecentTransaction(dto: RecentTransactionDto): RecentTransaction {
  return {
    id: dto.id,
    movement: dto.tipo,
    description: dto.descricao,
    amount: dto.valor,
    date: dto.data,
    categoryName: dto.categoriaNome,
    categoryColor: dto.categoriaCor,
  }
}

export function toDashboardSummary(dto: DashboardSummaryDto): DashboardSummary {
  return {
    totalIncome: dto.totalEntradas,
    totalExpenses: dto.totalSaidas,
    balance: dto.saldo,
    totalInvoices: dto.totalFaturas,
    incomeChange: dto.variacaoEntradas,
    expenseChange: dto.variacaoSaidas,
    incomeSeries: dto.serieEntradas.map(toSeriesPoint),
    expenseSeries: dto.serieSaidas.map(toSeriesPoint),
    // Os campos opcionais seguem ausentes quando o backend não os devolve: a
    // Dashboard trata a ausência como "sem cartão".
    invoiceSeries: dto.serieFaturas?.map(toSeriesPoint),
    expensesByCategory: dto.gastosPorCategoria.map(toCategoryTotal),
    // `?? []` cobre um backend que ainda não devolva `entradasPorCategoria`.
    incomeByCategory: (dto.entradasPorCategoria ?? []).map(toCategoryTotal),
    cardExpensesByType: dto.gastosCartoesPorTipo?.map((item) => ({
      type: item.tipo,
      total: item.total,
    })),
    cardExpensesByCategory: dto.gastosCartoesPorCategoria?.map(toCategoryTotal),
    recentTransactions: dto.transacoesRecentes.map(toRecentTransaction),
  }
}
