import type { ID } from './common'

/** Tipos de alerta do módulo Organização, como a API (`GET /alertas`) os devolve. */
export type NotificationKind = 'TAREFA_ATRASADA' | 'ROTINA_INCOMPLETA' | 'RESULTADO_SPRINT'

/**
 * Alerta exibido no popup de notificações do cabeçalho.
 * `AppNotification` para não colidir com a `Notification` global do navegador.
 */
export interface AppNotification {
  /** Estável entre chamadas (mesmo fato = mesmo id): é com ele que o "já visto" é guardado. */
  id: ID
  /** Define o ícone; opcional porque um tipo novo do backend não pode quebrar a tela. */
  kind?: NotificationKind | string
  title: string
  /** Texto curto: o item mostra no máximo duas linhas. */
  description: string
  /** Data no formato ISO `YYYY-MM-DD`. */
  date: string
}
