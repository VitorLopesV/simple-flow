import type { ID, SelectOption } from './common'

/**
 * Natureza da categoria, conforme o plano de contas do sistema. Os valores são os
 * gravados no banco e devolvidos pela API, por isso continuam em português.
 */
export type CategoryType =
  | 'CONTA_FIXA'
  | 'CONTA_VARIAVEL'
  | 'RENDA_FIXA'
  | 'RENDA_VARIAVEL'
  | 'RENDA'
  | 'INVESTIMENTO'
  | 'OUTROS'

/** Indica em qual página/fluxo a categoria pode ser usada. */
export type Movement = 'ENTRADA' | 'SAIDA'

export interface Category {
  id: ID
  name: string
  type: CategoryType
  movement: Movement
  /** Cor em hexadecimal usada em badges e gráficos. */
  color: string
}

export type CategoryPayload = Omit<Category, 'id'>

export const CATEGORY_TYPE_LABEL: Record<CategoryType, string> = {
  CONTA_FIXA: 'Conta Fixa',
  CONTA_VARIAVEL: 'Conta Variável',
  RENDA_FIXA: 'Renda Fixa',
  RENDA_VARIAVEL: 'Renda Variável',
  RENDA: 'Renda',
  INVESTIMENTO: 'Investimentos',
  OUTROS: 'Outros',
}

export const CATEGORY_TYPES: CategoryType[] = [
  'CONTA_FIXA',
  'CONTA_VARIAVEL',
  'RENDA_FIXA',
  'RENDA_VARIAVEL',
  'RENDA',
  'INVESTIMENTO',
  'OUTROS',
]

/** Natureza das categorias fixas (Despesa Fixa / Renda Fixa): as únicas que aceitam recorrência. */
export const FIXED_CATEGORY_TYPES: readonly CategoryType[] = ['CONTA_FIXA', 'RENDA_FIXA']

const FIXED_CATEGORY_NAMES = ['despesa fixa', 'renda fixa']

/**
 * Categoria fixa = Despesa Fixa ou Renda Fixa. Confere pela natureza e, como reforço,
 * pelo nome — um backend que grave Renda Fixa com outra natureza continua reconhecido.
 */
export function isFixedCategory(category: Pick<Category, 'type' | 'name'> | null | undefined): boolean {
  if (!category) return false
  return (
    FIXED_CATEGORY_TYPES.includes(category.type) ||
    FIXED_CATEGORY_NAMES.includes(category.name.trim().toLowerCase())
  )
}

export const CATEGORY_TYPE_OPTIONS: SelectOption<CategoryType>[] = CATEGORY_TYPES.map((type) => ({
  label: CATEGORY_TYPE_LABEL[type],
  value: type,
}))
