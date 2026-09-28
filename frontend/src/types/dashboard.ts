import type { ID, SeriePonto } from './common'
import type { SaidaTipo } from './saida'

export interface TransacaoRecente {
  id: ID
  tipo: 'ENTRADA' | 'SAIDA'
  descricao: string
  valor: number
  data: string
  categoriaNome: string
  categoriaCor: string
}

export interface DashboardResumo {
  totalEntradas: number
  totalSaidas: number
  saldo: number
  /**
   * Quanto de `totalSaidas` é fatura de cartão — recorte do mesmo conjunto, pelo
   * mês de vencimento da fatura, não pela competência.
   */
  totalFaturas: number
  variacaoEntradas: number
  variacaoSaidas: number
  /** Últimos 6 meses de entradas e saídas. */
  serieEntradas: SeriePonto[]
  serieSaidas: SeriePonto[]
  /**
   * Últimos 6 meses só de faturas de cartão — recorte de `serieSaidas`, não soma a mais.
   * Opcional: um backend que ainda não devolva a série é tratado como "sem cartão".
   */
  serieFaturas?: SeriePonto[]
  /** Distribuição das saídas por categoria no período. */
  gastosPorCategoria: { nome: string; cor: string; total: number }[]
  /** Distribuição das entradas por categoria no período. */
  entradasPorCategoria: { nome: string; cor: string; total: number }[]
  /**
   * Transações lançadas nos cartões, agrupadas por `SaidaTipo` — só as das faturas que
   * entram em `totalFaturas` (mesma regra de mês), então a soma bate com ele.
   * Opcional: um backend que ainda não devolva o campo é tratado como "sem cartão".
   */
  gastosCartoesPorTipo?: { tipo: SaidaTipo; total: number }[]
  /** Mesmas transações de `gastosCartoesPorTipo`, agrupadas por categoria. Opcional pelo mesmo motivo. */
  gastosCartoesPorCategoria?: { nome: string; cor: string; total: number }[]
  transacoesRecentes: TransacaoRecente[]
}
