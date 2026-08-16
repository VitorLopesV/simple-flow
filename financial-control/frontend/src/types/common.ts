/** Tipos transversais compartilhados por todos os domínios. */

/** Identificador de entidade. Alias explícito para facilitar troca por number/UUID. */
export type ID = string

/** Período de competência (mês/ano) usado em todos os filtros da aplicação. */
export interface Periodo {
  /** 1-12 */
  mes: number
  /** Ex.: 2026 */
  ano: number
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
  campo: TField
  direcao: SortDirection
}

/** Ponto de uma série temporal usada nos gráficos. */
export interface SeriePonto {
  label: string
  valor: number
}

export interface OpcaoSelect<T = string> {
  label: string
  value: T
  disabled?: boolean
}

/** Estado de requisição usado pelas stores. */
export interface RequestState {
  loading: boolean
  erro: string | null
}
