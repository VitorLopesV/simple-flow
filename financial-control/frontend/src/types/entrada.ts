import type { ID, PageRequest, Periodo } from './common'

export interface Entrada {
  id: ID
  descricao: string
  /** Valor em BRL, sempre positivo. */
  valor: number
  /** Data de competência no formato ISO `YYYY-MM-DD`. */
  data: string
  categoriaId: ID
  /** Marca receitas que se repetem todo mês (salário, aluguel recebido...). */
  recorrente: boolean
  observacao?: string
  criadoEm: string
  atualizadoEm: string
}

/** Dados aceitos pelo formulário de criação/edição. */
export type EntradaPayload = Omit<Entrada, 'id' | 'criadoEm' | 'atualizadoEm'>

export interface EntradaFiltro extends PageRequest {
  periodo: Periodo
  categoriaId?: ID | null
  busca?: string
}

export interface EntradaResumo {
  total: number
  quantidade: number
  media: number
  /** Total do mês anterior, para cálculo de variação percentual. */
  totalMesAnterior: number
  porCategoria: { categoriaId: ID; nome: string; cor: string; total: number }[]
}
