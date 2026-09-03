import type { ID, OpcaoSelect, PageRequest, Periodo } from './common'

export type SaidaStatus = 'PAGO' | 'PENDENTE'

export type FormaPagamento = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'BOLETO' | 'CARTAO_CREDITO'

/** Classificação específica da despesa, independente da categoria (fixa/variável/investimento). */
export type SaidaTipo =
  | 'TRANSPORTE'
  | 'ALIMENTACAO'
  | 'LAZER'
  | 'CONTA'
  | 'POUPANCA'
  | 'ACOES'
  | 'OUTROS'

export interface Saida {
  id: ID
  descricao: string
  /** Valor em BRL, sempre positivo. */
  valor: number
  /** Data de competência no formato ISO `YYYY-MM-DD`. */
  data: string
  categoriaId: ID
  tipo: SaidaTipo
  status: SaidaStatus
  formaPagamento: FormaPagamento
  /** Preenchido quando `formaPagamento === 'CARTAO_CREDITO'`. */
  cartaoId?: ID | null
  recorrente: boolean
  observacao?: string
  criadoEm: string
  atualizadoEm: string
  /** true = gerado automaticamente a partir da fatura de um cartão (não editável/removível diretamente). */
  automatica?: boolean
  /**
   * Preenchido só nas ocorrências futuras projetadas a partir de um lançamento
   * recorrente (ver `comRecorrencias` em `services/mock/db.ts`) — nunca persistidas,
   * recalculadas a cada leitura. Editável apenas pelo lançamento original.
   */
  origemRecorrenciaId?: ID
}

export type SaidaPayload = Omit<Saida, 'id' | 'criadoEm' | 'atualizadoEm'>

export interface SaidaFiltro extends PageRequest {
  periodo: Periodo
  categoriaId?: ID | null
  status?: SaidaStatus | null
  busca?: string
}

export interface SaidaResumo {
  total: number
  quantidade: number
  media: number
  totalPago: number
  totalPendente: number
  totalMesAnterior: number
  porCategoria: { categoriaId: ID; nome: string; cor: string; total: number }[]
}

export const SAIDA_STATUS_LABEL: Record<SaidaStatus, string> = {
  PAGO: 'Pago',
  PENDENTE: 'Pendente',
}

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'Pix',
  DEBITO: 'Débito',
  BOLETO: 'Boleto',
  CARTAO_CREDITO: 'Cartão de crédito',
}

export const FORMA_PAGAMENTO_OPCOES: OpcaoSelect<FormaPagamento>[] = (
  Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamento[]
).map((value) => ({ label: FORMA_PAGAMENTO_LABEL[value], value }))

export const SAIDA_STATUS_OPCOES: OpcaoSelect<SaidaStatus>[] = (
  Object.keys(SAIDA_STATUS_LABEL) as SaidaStatus[]
).map((value) => ({ label: SAIDA_STATUS_LABEL[value], value }))

export const SAIDA_TIPO_LABEL: Record<SaidaTipo, string> = {
  TRANSPORTE: 'Transporte',
  ALIMENTACAO: 'Alimentação',
  LAZER: 'Lazer',
  CONTA: 'Conta',
  POUPANCA: 'Poupança',
  ACOES: 'Ações',
  OUTROS: 'Outros',
}

export const SAIDA_TIPO_OPCOES: OpcaoSelect<SaidaTipo>[] = (
  Object.keys(SAIDA_TIPO_LABEL) as SaidaTipo[]
).map((value) => ({ label: SAIDA_TIPO_LABEL[value], value }))
