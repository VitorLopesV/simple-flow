import type { Task } from '@/types/task'

const CALENDAR_URL = 'https://calendar.google.com/calendar/render'
const TIME_ZONE = 'America/Sao_Paulo'
/** Duração do evento quando a tarefa não tem tempo estimado. */
const DEFAULT_DURATION_MINUTES = 30

/** Tarefa que pode virar evento: precisa de dia (`YYYY-MM-DD`) e hora (`HH:MM`). */
export function canAddToGoogleCalendar(task: Pick<Task, 'day' | 'time'>): boolean {
  return Boolean(task.day && task.time && /^\d{4}-\d{2}-\d{2}$/.test(task.day) && /^\d{2}:\d{2}$/.test(task.time))
}

/** Formata como `YYYYMMDDTHHMMSS` (horário local, sem `Z`: o fuso vai em `ctz`). */
function toCalendarDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`
  )
}

/**
 * Monta o link de criação de evento da Google Agenda já preenchido, ou `null` se a
 * tarefa não tem dia e hora. A soma usa `Date.UTC` só como calculadora de calendário
 * (o relógio local não entra), então o resultado independe do fuso do navegador e
 * vira o dia corretamente quando o fim passa da meia-noite.
 */
export function buildGoogleCalendarUrl(
  task: Pick<Task, 'title' | 'day' | 'time' | 'estimateMinutes' | 'notes'>,
): string | null {
  if (!canAddToGoogleCalendar(task)) return null
  const [year, month, day] = task.day!.split('-').map(Number)
  const [hour, minute] = task.time!.split(':').map(Number)
  const start = new Date(Date.UTC(year, month - 1, day, hour, minute))
  const end = new Date(start.getTime() + (task.estimateMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000)

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.title,
    dates: `${toCalendarDateTime(start)}/${toCalendarDateTime(end)}`,
    ctz: TIME_ZONE,
  })
  if (task.notes?.trim()) params.set('details', task.notes.trim())
  return `${CALENDAR_URL}?${params.toString()}`
}
