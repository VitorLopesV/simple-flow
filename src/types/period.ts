import type { Period } from './common'

/**
 * Intervalo de competências que o usuário pode navegar: do primeiro mês com dados
 * (entradas, saídas ou cartões) até o mês atual +1. Sem dados, começa no mês atual.
 */
export interface NavigationLimits {
  firstMonth: Period
  lastMonth: Period
}
