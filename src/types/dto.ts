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
import type { ActivityAction } from './dashboard'
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
  editadoManualmente?: boolean
  criadoEm: string
  atualizadoEm: string
}

export type IncomePayloadDto = Omit<
  IncomeDto,
  'id' | 'criadoEm' | 'atualizadoEm' | 'serieId' | 'editadoManualmente'
>

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
  editadoManualmente?: boolean
}

export type ExpensePayloadDto = Omit<
  ExpenseDto,
  'id' | 'criadoEm' | 'atualizadoEm' | 'serieId' | 'editadoManualmente'
>

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
  editadoManualmente?: boolean
  criadoEm: string
  atualizadoEm: string
}

export type CardTransactionPayloadDto = Omit<
  CardTransactionDto,
  'id' | 'cartaoId' | 'faturaId' | 'criadoEm' | 'atualizadoEm' | 'serieId' | 'editadoManualmente'
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

// ------------------------------------------------------------------ recorrência

/**
 * Corpo do 409 ao excluir/desligar a recorrência quando há meses seguintes alterados
 * (`editado_manualmente`, inclusive marcados como PAGO). Repetir a chamada com
 * `?confirmar=true` remove mesmo assim.
 */
export interface EditedMonthsConflictDto {
  message: string
  /** Competências `YYYY-MM` dos meses alterados. */
  mesesAlterados: string[]
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
  tipo: Movement | 'CARTAO'
  /** Opcional: um backend sem histórico de atividades não devolve o campo (vale 'ADICIONADO'). */
  acao?: ActivityAction
  ocorridoEm?: string
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

// -------------------------------------------------------------------- áreas

export interface AreaDto {
  id: ID
  nome: string
  cor: string
  sistema: boolean
  criadoEm: string
}

export type AreaPayloadDto = Pick<AreaDto, 'nome' | 'cor'>

// ------------------------------------------------------------------ tarefas

export interface TaskDto {
  id: ID
  areaId: ID
  titulo: string
  /** YYYY-MM-DD */
  dia: string | null
  /** HH:MM */
  hora: string | null
  tempoEstimado: 15 | 30 | 60 | 120 | 240 | null
  dificuldade: 'FACIL' | 'MEDIA' | 'DIFICIL' | null
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | null
  notas: string | null
  sprintId: ID | null
  /** Conclusão definitiva (#70): `atrasada` só é verdadeira depois de concluir. */
  concluidaEm: string | null
  concluida: boolean
  atrasada: boolean
  /** Super task pai (#65); `null` em tarefa avulsa. */
  superTaskId?: ID | null
  arquivada: boolean
  arquivadaEm: string | null
  criadoEm: string
  /** Segunda do sprint em que a tarefa não foi concluída (devolvida no fechamento, #71). */
  naoConcluidaNoSprintDe?: string | null
}

/** Criação (`POST /tarefas`) e edição (`PUT /tarefas/:id`, sem `areaId`). */
export type TaskEditDto = Omit<
  TaskDto,
  | 'id'
  | 'areaId'
  | 'sprintId'
  | 'concluidaEm'
  | 'concluida'
  | 'atrasada'
  | 'superTaskId'
  | 'arquivada'
  | 'arquivadaEm'
  | 'criadoEm'
  | 'naoConcluidaNoSprintDe'
>
export type TaskPayloadDto = TaskEditDto & Pick<TaskDto, 'areaId'>

// ------------------------------------------------------------- super task

/** Super task detalhada (#65): as filhas e os valores derivados vêm calculados pela API. */
export interface SuperTaskDto {
  id: ID
  areaId: ID
  titulo: string
  notas: string | null
  /** YYYY-MM-DD */
  dataTermino: string | null
  concluidaEm: string | null
  concluida: boolean
  arquivada: boolean
  arquivadaEm: string | null
  criadoEm: string
  filhas: TaskDto[]
  totalFilhas: number
  filhasConcluidas: number
  /** 0 a 100, arredondado para baixo. */
  progresso: number
  estado: 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'CONCLUIDA'
  vencida: boolean
  podeConcluir: boolean
}

export type SuperTaskEditDto = Pick<SuperTaskDto, 'titulo' | 'notas' | 'dataTermino'>
export type SuperTaskPayloadDto = SuperTaskEditDto & Pick<SuperTaskDto, 'areaId'>

// ------------------------------------------------------------------- rotina

export type RoutineRepeatDto =
  | { modo: 'DIAS_DA_SEMANA'; dias: (1 | 2 | 3 | 4 | 5)[] }
  | { modo: 'A_CADA_N_DIAS'; intervalo: number; dataInicial: string }

export interface RoutineItemDto {
  id: ID
  areaId: ID
  nome: string
  repeticao: RoutineRepeatDto
  vezes: { hora: string | null }[]
  criadoEm: string
}

/** Criação (`POST /rotinas`) e edição (`PUT /rotinas/:id`); o item vai sempre para a área Rotina. */
export type RoutinePayloadDto = Pick<RoutineItemDto, 'nome' | 'repeticao' | 'vezes'>

// ------------------------------------------------------------------- sprint

export interface SprintDto {
  id: ID
  inicio: string
  fim: string
  situacao: 'ABERTO' | 'FECHADO'
  rotinaGeradaEm: string | null
  criadoEm: string
  /** Recompensa própria do sprint; `null` = usa a padrão. */
  recompensa?: string | null
}

export interface RoutineOccurrenceDto {
  id: ID | null
  itemId: ID | null
  nome: string
  data: string
  hora: string | null
  indice: number
  ordem: number
  concluidaEm: string | null
}

/** `GET /sprints/atual` e `GET /sprints/proximo`. */
export interface SprintViewDto {
  sprint: SprintDto
  iniciado: boolean
  previa: boolean
  ocorrencias: RoutineOccurrenceDto[]
  lembretes: RoutineOccurrenceDto[]
  recompensaPadrao?: string | null
  recompensaEfetiva?: string | null
}

/** `PUT /sprints/{atual|proximo}/recompensa`. */
export interface SprintRewardDto {
  sprintId: ID
  inicio: string
  fim: string
  recompensa: string | null
  recompensaPadrao: string | null
  recompensaEfetiva: string | null
}

/** `GET`/`PUT /sprints/recompensa-padrao`. */
export interface DefaultRewardDto {
  recompensaPadrao: string | null
}

/** `GET /sprints/atual/placar` e `GET /sprints/proximo/placar`. */
export interface SprintScoreboardDto {
  sprintId: ID
  inicio: string
  fim: string
  iniciado: boolean
  previa: boolean
  /** Sprint fechado: `placar` é a foto gravada no fechamento. */
  fechado?: boolean
  recompensa?: string | null
  placar: {
    total: number
    feitos: number
    percentual: number
    bonus: boolean
    rotina: { diasComRotina: number; diasCumpridos: number; pontosPorDia: number; total: number; feitos: number }
    tarefas: { quantidade: number; concluidas: number; total: number; feitos: number }
  }
}
