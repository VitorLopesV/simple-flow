import type { ID, PageRequest, Period } from './common'

export interface Income {
  id: ID
  description: string
  /** Valor em BRL, sempre positivo. */
  amount: number
  /** Data de competência no formato ISO `YYYY-MM-DD`. */
  date: string
  categoryId: ID
  /** Marca receitas que se repetem todo mês (salário, aluguel recebido...). */
  recurring: boolean
  notes?: string
  createdAt: string
  updatedAt: string
  /**
   * Preenchido só nas ocorrências futuras projetadas a partir de um lançamento
   * recorrente (ver `withRecurrences` em `services/mock/db.ts`) — nunca persistidas,
   * recalculadas a cada leitura. Editar uma dessas ocorrências materializa uma linha
   * própria para aquele mês, independente do original.
   */
  recurrenceOriginId?: ID
}

/** Dados aceitos pelo formulário de criação/edição. */
export type IncomePayload = Omit<Income, 'id' | 'createdAt' | 'updatedAt'>

export interface IncomeFilter extends PageRequest {
  period: Period
  categoryId?: ID | null
  search?: string
}

export interface IncomeSummary {
  total: number
  count: number
  average: number
  /** Total do mês anterior, para cálculo de variação percentual. */
  previousMonthTotal: number
  byCategory: { categoryId: ID; name: string; color: string; total: number }[]
}
