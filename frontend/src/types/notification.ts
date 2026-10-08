import type { ID } from './common'

/**
 * Alerta exibido no popup de notificações do cabeçalho. A origem e as regras dos
 * alertas ainda serão definidas; por ora o tipo descreve só o que o popup exibe.
 * `AppNotification` para não colidir com a `Notification` global do navegador.
 */
export interface AppNotification {
  id: ID
  title: string
  /** Texto curto: o item mostra no máximo duas linhas. */
  description: string
  /** Data no formato ISO `YYYY-MM-DD`. */
  date: string
}
