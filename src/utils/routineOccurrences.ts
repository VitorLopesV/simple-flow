import type { RoutineItem } from '@/types/routine'

/** Uma ocorrência: o dia (`YYYY-MM-DD`) e a hora (`HH:MM`) opcional daquela vez. */
export interface RoutineOccurrence {
  date: string
  time: string | null
}

export interface RoutineOccurrences {
  /** Segunda a sexta: entram no sprint e pontuam. */
  weekdays: RoutineOccurrence[]
  /** Sábado e domingo (só em "a cada N dias"): lembretes, fora do sprint e sem pontos. */
  weekendReminders: RoutineOccurrence[]
}

const DAY_MS = 86_400_000

/**
 * Datas são tratadas como UTC puro (`YYYY-MM-DD` → meia-noite UTC), igual ao backend,
 * para que o fuso do navegador nunca desloque o dia.
 */
function toDayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS)
}

function toIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

/** ISO: 1 = segunda ... 7 = domingo. O dia 0 (01/01/1970) foi uma quinta. */
function weekdayOf(day: number): number {
  return ((((day + 3) % 7) + 7) % 7) + 1
}

/** Ordem estável dentro do dia: vez sem hora primeiro, depois por horário. */
function compareTimes(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return -1
  if (b === null) return 1
  return a < b ? -1 : 1
}

/**
 * Ocorrências de um item de rotina em `[start, end]` (inclusivos, `YYYY-MM-DD`), em ordem
 * cronológica; cada vez do dia é uma ocorrência. Mesma regra do backend (`calcularOcorrencias`).
 * Intervalo invertido devolve vazio.
 */
export function calculateOccurrences(
  item: Pick<RoutineItem, 'repeat' | 'times'>,
  start: string,
  end: string,
): RoutineOccurrences {
  const result: RoutineOccurrences = { weekdays: [], weekendReminders: [] }
  const first = toDayNumber(start)
  const last = toDayNumber(end)
  const times = item.times.map((slot) => slot.time).sort(compareTimes)
  const { repeat } = item

  const add = (day: number) => {
    const list = weekdayOf(day) <= 5 ? result.weekdays : result.weekendReminders
    for (const time of times) list.push({ date: toIso(day), time })
  }

  if (repeat.mode === 'DIAS_DA_SEMANA') {
    const days = new Set<number>(repeat.days)
    for (let day = first; day <= last; day++) {
      if (days.has(weekdayOf(day))) add(day)
    }
    return result
  }

  const initial = toDayNumber(repeat.startDate)
  // Primeiro múltiplo do intervalo, a partir da data inicial, que não é anterior ao início.
  const steps = first <= initial ? 0 : Math.ceil((first - initial) / repeat.interval)
  for (let day = initial + steps * repeat.interval; day <= last; day += repeat.interval) {
    add(day)
  }
  return result
}

/** Soma dias a um `YYYY-MM-DD` sem passar pelo fuso local. */
export function addDaysIso(iso: string, amount: number): string {
  return toIso(toDayNumber(iso) + amount)
}

export interface UpcomingOccurrence extends RoutineOccurrence {
  /** `true` para sábado/domingo: lembrete sem pontos. */
  reminder: boolean
}

/** Próximas ocorrências (dias úteis e lembretes juntos, em ordem) a partir de `from`, em até `windowDays`. */
export function upcomingOccurrences(
  item: Pick<RoutineItem, 'repeat' | 'times'>,
  from: string,
  limit = 5,
  windowDays = 60,
): UpcomingOccurrence[] {
  const { weekdays, weekendReminders } = calculateOccurrences(item, from, addDaysIso(from, windowDays))
  return [
    ...weekdays.map((o) => ({ ...o, reminder: false })),
    ...weekendReminders.map((o) => ({ ...o, reminder: true })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date) || compareTimes(a.time, b.time))
    .slice(0, limit)
}
