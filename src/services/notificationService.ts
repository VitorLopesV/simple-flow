import type { AlertsDto } from '@/types/dto'
import type { AppNotification, NotificationKind } from '@/types/notification'
import { formatDate, toISODate } from '@/utils/dateFormatter'
import { addDays, mondayOf } from '@/utils/sprint'
import { wouldBeLate } from '@/utils/taskCompletion'
import { http, USE_MOCK } from './http'
import { toNotifications } from './mappers'
import { delay } from './mock'
import { sprintService } from './sprintService'

/** Mesma ordem do backend no mesmo dia: resultado, rotina, tarefas. */
const KIND_ORDER: Record<NotificationKind, number> = { RESULTADO_SPRINT: 0, ROTINA_INCOMPLETA: 1, TAREFA_ATRASADA: 2 }
/** A rotina incompleta só alerta a partir das 20:00. */
const ROUTINE_ALERT_HOUR = 20

function shortDate(iso: string): string {
  return formatDate(iso).slice(0, 5)
}

export const notificationService = {
  /**
   * Alertas do módulo Organização, calculados na hora (nada é gravado), como `GET /alertas` (#75):
   * tarefa atrasada do sprint aberto, rotina do dia incompleta depois das 20h e o resultado do sprint
   * recém-fechado (fim de semana). Ordem: data decrescente, tipo e id.
   */
  async list(): Promise<AppNotification[]> {
    if (USE_MOCK) {
      const now = new Date()
      const today = toISODate(now)
      const [view, board] = await Promise.all([sprintService.get('current'), sprintService.getScoreboard('current')])
      const alerts: (AppNotification & { kind: NotificationKind })[] = []

      if (view.sprint.status === 'FECHADO') {
        const { percentage, bonus } = board.scoreboard
        const sprintOf = shortDate(board.startDate)
        const percent = `${percentage.toLocaleString('pt-BR')}%`
        alerts.push({
          id: `resultado-sprint:${board.sprintId}`,
          kind: 'RESULTADO_SPRINT',
          title: bonus ? 'Bônus do sprint liberado' : 'Bônus do sprint não liberado',
          description: bonus
            ? `Você fechou o sprint de ${sprintOf} com ${percent}.${board.reward ? ` Recompensa: ${board.reward}.` : ''}`
            : `O sprint de ${sprintOf} fechou com ${percent} (meta: 90%).`,
          date: addDays(mondayOf(today), 4),
        })
      } else {
        const tasks = await sprintService.listTasks(view.sprint.id)
        for (const task of tasks) {
          if (task.done || !task.day || !wouldBeLate(task, now)) continue
          const at = task.time ? ` às ${task.time.slice(0, 5)}` : ''
          alerts.push({
            id: `tarefa-atrasada:${task.id}:${task.day}`,
            kind: 'TAREFA_ATRASADA',
            title: 'Tarefa atrasada',
            description: `"${task.title}" venceu em ${shortDate(task.day)}${at}. Concluir agora vale só 20% dos pontos.`,
            date: task.day,
          })
        }

        const todays = view.occurrences.filter((entry) => entry.date === today)
        const done = todays.filter((entry) => entry.completedAt).length
        if (now.getHours() >= ROUTINE_ALERT_HOUR && todays.length > done) {
          alerts.push({
            id: `rotina-incompleta:${today}`,
            kind: 'ROTINA_INCOMPLETA',
            title: 'Rotina de hoje incompleta',
            description: `Você concluiu ${done} de ${todays.length} itens da rotina. Cumpra a missão do dia para pontuar.`,
            date: today,
          })
        }
      }

      alerts.sort(
        (a, b) => b.date.localeCompare(a.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id),
      )
      return delay(alerts)
    }

    const { data } = await http.get<AlertsDto>('/alertas')
    return toNotifications(data)
  },
}
