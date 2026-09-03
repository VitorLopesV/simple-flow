import type { ID, OpcaoSelect, Periodo } from './common'
import type { SaidaTipo } from './saida'

export type Bandeira = 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD'

export interface Cartao {
  id: ID
  nome: string
  bandeira: Bandeira
  /** Últimos 4 dígitos — nunca armazenamos o número completo. */
  ultimosDigitos: string
  limite: number
  /** Dia do mês em que a fatura fecha (1-28). */
  diaFechamento: number
  /** Dia do mês de vencimento da fatura (1-28). */
  diaVencimento: number
  cor: string
  ativo: boolean
  criadoEm: string
}

export type CartaoPayload = Omit<Cartao, 'id' | 'criadoEm'>

/**
 * Débito lançado direto no cartão — mesmo formato de uma `Saida`, sem forma de
 * pagamento (é sempre o cartão) e sem situação própria (quem é paga é a fatura).
 */
export interface TransacaoCartao {
  id: ID
  cartaoId: ID
  faturaId: ID
  descricao: string
  valor: number
  data: string
  categoriaId: ID
  tipo: SaidaTipo
  parcelaAtual: number
  totalParcelas: number
  recorrente: boolean
  observacao?: string | null
  criadoEm: string
  atualizadoEm: string
  /**
   * Preenchido só nas ocorrências futuras projetadas a partir de uma transação
   * recorrente — nunca persistido, recalculado a cada leitura. A fatura a que
   * pertence pode inclusive ser virtual (ver `Fatura.id`), quando o mês ainda não
   * tem fatura própria.
   */
  origemRecorrenciaId?: ID
}

export type TransacaoCartaoPayload = Omit<
  TransacaoCartao,
  'id' | 'cartaoId' | 'faturaId' | 'criadoEm' | 'atualizadoEm' | 'origemRecorrenciaId'
>

export type FaturaStatus = 'ABERTA' | 'FECHADA' | 'PAGA' | 'ATRASADA'

export interface Fatura {
  id: ID
  cartaoId: ID
  /** Competência no formato `YYYY-MM`. */
  competencia: string
  fechamento: string
  vencimento: string
  total: number
  status: FaturaStatus
  pagoEm?: string | null
}

export interface FaturaDetalhada extends Fatura {
  transacoes: TransacaoCartao[]
}

export interface CartaoComFatura {
  cartao: Cartao
  fatura: FaturaDetalhada | null
  /** Percentual do limite comprometido pela fatura em aberto (0-100). */
  usoLimite: number
}

export interface FaturaFiltro {
  cartaoId?: ID | null
  periodo: Periodo
}

export const BANDEIRA_LABEL: Record<Bandeira, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  ELO: 'Elo',
  AMEX: 'American Express',
  HIPERCARD: 'Hipercard',
}

export const BANDEIRA_OPCOES: OpcaoSelect<Bandeira>[] = (
  Object.keys(BANDEIRA_LABEL) as Bandeira[]
).map((value) => ({ label: BANDEIRA_LABEL[value], value }))

export const FATURA_STATUS_LABEL: Record<FaturaStatus, string> = {
  ABERTA: 'Aberta',
  FECHADA: 'Fechada',
  PAGA: 'Paga',
  ATRASADA: 'Atrasada',
}
