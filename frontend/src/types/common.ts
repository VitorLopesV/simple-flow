/** Tipos transversais compartilhados por todos os domínios. */

/** Identificador de entidade. Alias explícito para facilitar troca por number/UUID. */
export type ID = string

/** Período de competência (mês/ano) usado em todos os filtros da aplicação. */
export interface Period {
  /** 1-12 */
  month: number
  /** Ex.: 2026 */
  year: number
}

export interface PageRequest {
  page: number
  pageSize: number
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type SortDirection = 'asc' | 'desc'

export interface SortRequest<TField extends string = string> {
  field: TField
  direction: SortDirection
}

/** Ponto de uma série temporal usada nos gráficos. */
export interface SeriesPoint {
  label: string
  value: number
}

export interface SelectOption<T = string> {
  label: string
  value: T
  disabled?: boolean
}

/** Estado de requisição usado pelas stores. */
export interface RequestState {
  loading: boolean
  error: string | null
}
