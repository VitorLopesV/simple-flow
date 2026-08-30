import type { ID, OpcaoSelect } from './common'

/** Natureza da categoria, conforme o plano de contas do sistema. */
export type CategoriaTipo = 'CONTA_FIXA' | 'CONTA_VARIAVEL' | 'RENDA' | 'INVESTIMENTO' | 'OUTROS'

/** Indica em qual página/fluxo a categoria pode ser usada. */
export type Movimento = 'ENTRADA' | 'SAIDA'

export interface Categoria {
  id: ID
  nome: string
  tipo: CategoriaTipo
  movimento: Movimento
  /** Cor em hexadecimal usada em badges e gráficos. */
  cor: string
}

export type CategoriaPayload = Omit<Categoria, 'id'>

export const CATEGORIA_TIPO_LABEL: Record<CategoriaTipo, string> = {
  CONTA_FIXA: 'Conta Fixa',
  CONTA_VARIAVEL: 'Conta Variável',
  RENDA: 'Renda',
  INVESTIMENTO: 'Investimentos',
  OUTROS: 'Outros',
}

export const CATEGORIA_TIPOS: CategoriaTipo[] = [
  'CONTA_FIXA',
  'CONTA_VARIAVEL',
  'RENDA',
  'INVESTIMENTO',
  'OUTROS',
]

export const CATEGORIA_TIPO_OPCOES: OpcaoSelect<CategoriaTipo>[] = CATEGORIA_TIPOS.map((tipo) => ({
  label: CATEGORIA_TIPO_LABEL[tipo],
  value: tipo,
}))
