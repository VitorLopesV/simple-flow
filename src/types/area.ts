import type { ID } from './common'

/**
 * Lista que agrupa tarefas no módulo Organização. `system` marca a área Rotina,
 * criada automaticamente pelo backend, que não pode ser editada nem excluída.
 */
export interface Area {
  id: ID
  name: string
  color: string
  system: boolean
  createdAt: string
}

export type AreaPayload = Pick<Area, 'name' | 'color'>

/** Escolha ao excluir uma área: mover as tarefas para outra área ou excluí-las junto. */
export type AreaTasksDestination = { action: 'move'; targetAreaId: ID } | { action: 'delete' }

/**
 * Paleta fixa de cores das áreas (tons do tema escuro). Fica aqui, e não nos
 * componentes, porque o valor `#RRGGBB` é gravado na API.
 */
export const AREA_COLORS: readonly { label: string; value: string }[] = [
  { label: 'Índigo', value: '#6366f1' },
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Ciano', value: '#06b6d4' },
  { label: 'Verde', value: '#22c55e' },
  { label: 'Amarelo', value: '#eab308' },
  { label: 'Laranja', value: '#f97316' },
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Rosa', value: '#ec4899' },
  { label: 'Roxo', value: '#8b5cf6' },
]

export const DEFAULT_AREA_COLOR = AREA_COLORS[0]!.value
