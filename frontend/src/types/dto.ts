/**
 * Formato do JSON trocado com a API (`simple-flow-backend`).
 *
 * O contrato da API continua em português, então os campos destas interfaces
 * também — é o único lugar do frontend com nomes de campo em português. O resto
 * do código usa os tipos de domínio em inglês, e a conversão entre os dois
 * formatos fica em `services/mappers.ts`, chamada só na borda HTTP dos services.
 */
import type { CategoryType, Movement } from './category'
import type { ID } from './common'
import type { CardBrand, InvoiceStatus } from './creditCard'
import type { ExpenseStatus, ExpenseType, PaymentMethod } from './expense'
import type { IncomeType } from './income'

export interface SeriesPointDto {
  label: string
  valor: number
}

export interface CategoryTotalDto {
  nome: string
  cor: string
  total: number
}

// ---------------------------------------------------------------------- auth

export interface UserDto {
  id: ID
  email: string
  nome: string | null
  telefone?: string | null
  fotoUrl?: string | null
}

export interface UserSessionDto {
  usuario: UserDto
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginDto {
  email: string
  senha: string
}

export interface RegisterDto {
  email: string
  senha: string
  nome?: string
}

export interface ProfileDto {
  nome: string
  email: string
  telefone: string | null
  fotoUrl: string | null
}

// ---------------------------------------------------------------- categorias

export interface CategoryDto {
  id: ID
  nome: string
  tipo: CategoryType
  movimento: Movement
  cor: string
}

// ------------------------------------------------------------------ entradas

export interface IncomeDto {
  id: ID
  descricao: string
  valor: number
  data: string
  categoriaId: ID
  tipo: IncomeType
  recorrente: boolean
  observacao?: string
  /** Série do lançamento recorrente (`serie_id`); `null` fora de série. */
  serieId?: ID | null
  criadoEm: string
  atualizadoEm: string
}

export type IncomePayloadDto = Omit<IncomeDto, 'id' | 'criadoEm' | 'atualizadoEm' | 'serieId'>

export interface IncomeSummaryDto {
  total: number
  quantidade: number
  media: number
  totalMesAnterior: number
  porCategoria: ({ categoriaId: ID } & CategoryTotalDto)[]
}

// -------------------------------------------------------------------- saídas

export interface ExpenseDto {
  id: ID
  descricao: string
  valor: number
  data: string
  categoriaId: ID
  tipo: ExpenseType
  status: ExpenseStatus
  vencimento?: string | null
  pagoEm?: string | null
  formaPagamento: PaymentMethod
  cartaoId?: ID | null
  recorrente: boolean
  observacao?: string
  criadoEm: string
  atualizadoEm: string
  automatica?: boolean
  serieId?: ID | null
}

export type ExpensePayloadDto = Omit<ExpenseDto, 'id' | 'criadoEm' | 'atualizadoEm' | 'serieId'>

export interface ExpenseSummaryDto {
  total: number
  quantidade: number
  media: number
  totalPago: number
  totalPendente: number
  totalMesAnterior: number
  porCategoria: ({ categoriaId: ID } & CategoryTotalDto)[]
  porTipo: { tipo: ExpenseType; total: number }[]
}

// ------------------------------------------------------------------- cartões

export interface CreditCardDto {
  id: ID
  nome: string
  bandeira: CardBrand
  ultimosDigitos: string
  limite: number
  diaFechamento: number
  diaVencimento: number
  cor: string
  ativo: boolean
  criadoEm: string
}

export type CreditCardPayloadDto = Omit<CreditCardDto, 'id' | 'criadoEm'>

export interface CardTransactionDto {
  id: ID
  cartaoId: ID
  faturaId: ID
  descricao: string
  valor: number
  data: string
  categoriaId: ID
  tipo: ExpenseType
  parcelaAtual: number
  totalParcelas: number
  recorrente: boolean
  observacao?: string | null
  serieId?: ID | null
  criadoEm: string
  atualizadoEm: string
}

export type CardTransactionPayloadDto = Omit<
  CardTransactionDto,
  'id' | 'cartaoId' | 'faturaId' | 'criadoEm' | 'atualizadoEm' | 'serieId'
>

export interface DetailedInvoiceDto {
  id: ID
  cartaoId: ID
  competencia: string
  fechamento: string
  vencimento: string
  total: number
  status: InvoiceStatus
  pagoEm?: string | null
  transacoes: CardTransactionDto[]
}

export interface CreditCardWithInvoiceDto {
  cartao: CreditCardDto
  fatura: DetailedInvoiceDto | null
  usoLimite: number
}

// ---------------------------------------------------------------- competências

/** `GET /competencias/limites` — meses no formato `YYYY-MM`. */
export interface NavigationLimitsDto {
  primeiroMes: string
  ultimoMes: string
}

// ----------------------------------------------------------------- dashboard

export interface RecentTransactionDto {
  id: ID
  tipo: Movement
  descricao: string
  valor: number
  data: string
  categoriaNome: string
  categoriaCor: string
}

export interface DashboardSummaryDto {
  totalEntradas: number
  totalSaidas: number
  saldo: number
  totalFaturas: number
  variacaoEntradas: number
  variacaoSaidas: number
  serieEntradas: SeriesPointDto[]
  serieSaidas: SeriesPointDto[]
  serieFaturas?: SeriesPointDto[]
  gastosPorCategoria: CategoryTotalDto[]
  entradasPorCategoria?: CategoryTotalDto[]
  gastosCartoesPorTipo?: { tipo: ExpenseType; total: number }[]
  gastosCartoesPorCategoria?: CategoryTotalDto[]
  transacoesRecentes: RecentTransactionDto[]
}
