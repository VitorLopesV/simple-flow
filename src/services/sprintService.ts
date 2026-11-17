import type { DefaultRewardDto, RoutineOccurrenceDto, SprintRewardDto, SprintScoreboardDto, SprintViewDto, TaskDto } from '@/types/dto'
import type { RoutineItem } from '@/types/routine'
import type { RoutineOccurrence, Scoreboard, SprintReward, SprintScoreboard, SprintView, SprintWhich } from '@/types/sprint'
import { normalizeReward, REWARD_MAX_LENGTH } from '@/types/sprint'
import type { Task } from '@/types/task'
import { missingSprintFields } from '@/types/task'
import { toDate, toISODate } from '@/utils/dateFormatter'
import { addDays, mondayOf } from '@/utils/sprint'
import { fullPoints, latePoints } from '@/utils/taskCompletion'
import { http, USE_MOCK } from './http'
import { DONE_TASK_MESSAGE } from './taskService'
import { toRoutineOccurrence, toSprintReward, toSprintScoreboard, toSprintView, toTask } from './mappers'
import { delay, mockDb } from './mock'

type Db = Awaited<ReturnType<typeof mockDb>>

const ROUTE: Record<SprintWhich, string> = { current: 'atual', next: 'proximo' }
const ROUTINE_DAY_POINTS = 40

function today(): string {
  return toISODate(new Date())
}

function startOf(which: SprintWhich): string {
  const monday = mondayOf(today())
  return which === 'current' ? monday : addDays(monday, 7)
}

function sprintId(startDate: string): string {
  return `spr_${startDate}`
}

function isWeekend(iso: string): boolean {
  const weekday = toDate(iso).getDay()
  return weekday === 0 || weekday === 6
}

function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000)
}

/** Vezes do item que caem em `date`, como `calcularOcorrencias` do backend (versão simplificada). */
function occurrencesOn(item: RoutineItem, date: string): RoutineOccurrence[] {
  const { repeat } = item
  const matches =
    repeat.mode === 'DIAS_DA_SEMANA'
      ? (repeat.days as number[]).includes(toDate(date).getDay())
      : daysBetween(repeat.startDate, date) >= 0 && daysBetween(repeat.startDate, date) % repeat.interval === 0
  if (!matches) return []
  return item.times.map((slot, index) => ({
    id: null,
    itemId: item.id,
    name: item.name,
    date,
    time: slot.time,
    index,
    order: 0,
    completedAt: null,
  }))
}

/** Por dia: vezes sem hora primeiro, depois por horário e nome. */
function sortOccurrences(list: RoutineOccurrence[], withIds: boolean): RoutineOccurrence[] {
  const sorted = [...list].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? '').localeCompare(b.time ?? '') ||
      a.name.localeCompare(b.name, 'pt-BR'),
  )
  return sorted.map((occurrence, order) => ({
    ...occurrence,
    order,
    id: withIds ? `ocr_${occurrence.itemId}_${occurrence.date}_${occurrence.index}` : null,
  }))
}

/** Aplica as conclusões gravadas no mock (só ocorrências com id, ou seja, de sprint iniciado). */
function withCompletion(db: Db, list: RoutineOccurrence[]): RoutineOccurrence[] {
  return list.map((entry) => ({ ...entry, completedAt: (entry.id && db.completedOccurrences.get(entry.id)) || null }))
}

/** No fim de semana o sprint "atual" é o que acabou de fechar, como no backend (#71). */
function isClosed(which: SprintWhich): boolean {
  return which === 'current' && isWeekend(today())
}

const CLOSED_REWARD_MESSAGE = 'O sprint já foi fechado: a recompensa dele não pode mais ser alterada.'

function mockView(db: Db, which: SprintWhich): SprintView {
  const startDate = startOf(which)
  const started = which === 'current'
  const id = sprintId(startDate)
  const reward = db.sprintRewards.get(id) ?? null
  const occurrences: RoutineOccurrence[] = []
  const reminders: RoutineOccurrence[] = []
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(startDate, offset)
    const target = offset < 5 ? occurrences : reminders
    db.routineItems.forEach((item) => {
      // Sáb/dom só existem no modo "a cada N dias" e viram lembretes, sem pontos.
      if (offset >= 5 && item.repeat.mode !== 'A_CADA_N_DIAS') return
      target.push(...occurrencesOn(item, date))
    })
  }
  return {
    sprint: {
      id: sprintId(startDate),
      startDate,
      endDate: addDays(startDate, 4),
      status: isClosed(which) ? 'FECHADO' : 'ABERTO',
      startedRoutineAt: started ? db.now() : null,
      createdAt: db.now(),
      reward,
    },
    started,
    preview: !started,
    occurrences: withCompletion(db, sortOccurrences(occurrences, started)),
    reminders: withCompletion(db, sortOccurrences(reminders, started)),
    defaultReward: db.defaultReward.value,
    // Recompensa efetiva: a do sprint, senão a padrão.
    effectiveReward: reward ?? db.defaultReward.value,
  }
}

/** Placar com a mesma fórmula do backend: rotina 40 pts por dia útil (tudo ou nada) + tarefas. */
function mockScoreboard(db: Db, which: SprintWhich): SprintScoreboard {
  const view = mockView(db, which)
  const byDay = new Map<string, RoutineOccurrence[]>()
  view.occurrences.forEach((entry) => byDay.set(entry.date, [...(byDay.get(entry.date) ?? []), entry]))
  const daysCompleted = [...byDay.values()].filter((list) => list.every((entry) => entry.completedAt)).length
  const sprintTasks = db.tasks.filter((task) => task.sprintId === view.sprint.id && !task.archived)
  // O total mantém os pontos cheios; a tarefa atrasada vale 20% nos feitos.
  const points = (task: Task) => fullPoints(task) ?? 0
  const earned = (task: Task) => (task.late ? latePoints(task) : fullPoints(task)) ?? 0
  const tasksTotal = sprintTasks.reduce((sum, task) => sum + points(task), 0)
  const tasksDone = sprintTasks.filter((task) => task.done).reduce((sum, task) => sum + earned(task), 0)

  const total = byDay.size * ROUTINE_DAY_POINTS + tasksTotal
  const done = daysCompleted * ROUTINE_DAY_POINTS + tasksDone
  const scoreboard: Scoreboard = {
    total,
    done,
    percentage: total === 0 ? 0 : Math.round((done / total) * 1000) / 10,
    // Comparação em inteiros: 89,96% arredonda para 90,0 mas não dá bônus.
    bonus: total > 0 && done * 10 >= total * 9,
    routine: {
      daysWithRoutine: byDay.size,
      daysCompleted,
      pointsPerDay: ROUTINE_DAY_POINTS,
      total: byDay.size * ROUTINE_DAY_POINTS,
      done: daysCompleted * ROUTINE_DAY_POINTS,
    },
    tasks: {
      count: sprintTasks.length,
      completed: sprintTasks.filter((task) => task.done).length,
      total: tasksTotal,
      done: tasksDone,
    },
  }
  return {
    sprintId: view.sprint.id,
    startDate: view.sprint.startDate,
    endDate: view.sprint.endDate,
    started: view.started,
    preview: view.preview,
    closed: view.sprint.status === 'FECHADO',
    reward: view.effectiveReward,
    scoreboard,
  }
}

function findTask(db: Db, id: string): Task {
  const task = db.tasks.find((item) => item.id === id)
  if (!task) throw new Error('Tarefa não encontrada.')
  return task
}

/** Mesmas recusas do backend (422) para o dia escolhido; devolve o id do sprint do dia. */
function assertValidDay(day: string): string {
  if (isWeekend(day)) throw new Error('O sprint só tem dias úteis, de segunda a sexta.')
  if (day < today()) throw new Error('Esse dia já passou: escolha hoje ou um dia futuro.')
  const monday = mondayOf(day)
  if (monday !== startOf('current') && monday !== startOf('next')) {
    throw new Error('O dia precisa estar no sprint atual ou no próximo.')
  }
  return sprintId(monday)
}

/** Tarefa de dia que já passou fica travada (409 no backend): só poderá ser concluída. */
function assertUnlocked(task: Task): void {
  if (task.done) throw new Error(DONE_TASK_MESSAGE)
  if (task.day && task.day < today()) {
    throw new Error('Essa tarefa é de um dia que já passou: ela só pode ser concluída.')
  }
}

function assertInSprint(task: Task): void {
  if (!task.sprintId) throw new Error('A tarefa não está no sprint.')
}

export const sprintService = {
  /** Sprint com a rotina da semana. */
  async get(which: SprintWhich): Promise<SprintView> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(mockView(db, which))
    }

    const { data } = await http.get<SprintViewDto>(`/sprints/${ROUTE[which]}`)
    return toSprintView(data)
  },

  async getScoreboard(which: SprintWhich): Promise<SprintScoreboard> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(mockScoreboard(db, which))
    }

    const { data } = await http.get<SprintScoreboardDto>(`/sprints/${ROUTE[which]}/placar`)
    return toSprintScoreboard(data)
  },

  /** Tarefas do sprint `id`: a API de tarefas devolve `sprintId` em cada uma. */
  async listTasks(id: string): Promise<Task[]> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(db.clone(db.tasks).filter((task) => task.sprintId === id && !task.archived))
    }

    const { data } = await http.get<TaskDto[]>('/tarefas')
    return data.map(toTask).filter((task) => task.sprintId === id)
  },

  /** Põe uma tarefa do backlog no sprint do `day` (sem `day`, usa o que a tarefa já tem). */
  async addTask(taskId: string, day?: string): Promise<Task> {
    if (USE_MOCK) {
      const db = await mockDb()
      const task = findTask(db, taskId)
      if (task.done) throw new Error(DONE_TASK_MESSAGE)
      if (task.archived) throw new Error('Tarefa arquivada não entra no sprint.')
      if (task.sprintId) throw new Error('A tarefa já está no sprint.')
      const target = day ?? task.day
      if (!target) throw new Error('Informe o dia da tarefa.')
      const missing = missingSprintFields({ ...task, day: target })
      if (missing.length) throw new Error(`Faltam para entrar no sprint: ${missing.join(', ')}.`)
      task.sprintId = assertValidDay(target)
      task.day = target
      return delay(db.clone(task))
    }

    const { data } = await http.post<TaskDto>('/sprints/tarefas', { tarefaId: taskId, dia: day })
    return toTask(data)
  },

  async moveTask(taskId: string, day: string): Promise<Task> {
    if (USE_MOCK) {
      const db = await mockDb()
      const task = findTask(db, taskId)
      assertUnlocked(task)
      assertInSprint(task)
      task.sprintId = assertValidDay(day)
      task.day = day
      return delay(db.clone(task))
    }

    const { data } = await http.patch<TaskDto>(`/sprints/tarefas/${taskId}/dia`, { dia: day })
    return toTask(data)
  },

  /**
   * Conclui a ocorrência da rotina, só no próprio dia (422 no backend). Idempotente e definitiva.
   * Na prévia (sprint que não começou) não há ocorrência gravada, então nada a concluir.
   */
  async completeOccurrence(occurrenceId: string): Promise<RoutineOccurrence> {
    if (USE_MOCK) {
      const db = await mockDb()
      const view = mockView(db, 'current')
      const occurrence = [...view.occurrences, ...view.reminders].find((entry) => entry.id === occurrenceId)
      if (!occurrence) throw new Error('Ocorrência não encontrada.')
      if (occurrence.date !== today()) {
        throw new Error('A rotina só pode ser concluída no próprio dia.')
      }
      if (!db.completedOccurrences.has(occurrenceId)) db.completedOccurrences.set(occurrenceId, db.now())
      return delay({ ...occurrence, completedAt: db.completedOccurrences.get(occurrenceId)! })
    }

    const { data } = await http.patch<RoutineOccurrenceDto>(`/sprints/ocorrencias/${occurrenceId}/concluir`)
    return toRoutineOccurrence(data)
  },

  /**
   * Define a recompensa do sprint (`null`/vazio volta a usar a padrão). Recusas como no backend:
   * 409 se o sprint já fechou (ex.: `current` no fim de semana) e 422 se passar de 120 caracteres.
   */
  async setReward(which: SprintWhich, reward: string | null): Promise<SprintReward> {
    if (USE_MOCK) {
      const db = await mockDb()
      if (isClosed(which)) throw new Error(CLOSED_REWARD_MESSAGE)
      const text = normalizeReward(reward)
      if (text && text.length > REWARD_MAX_LENGTH) {
        throw new Error(`A recompensa deve ter no máximo ${REWARD_MAX_LENGTH} caracteres.`)
      }
      const view = mockView(db, which)
      if (text) db.sprintRewards.set(view.sprint.id, text)
      else db.sprintRewards.delete(view.sprint.id)
      const own = text
      return delay({
        sprintId: view.sprint.id,
        startDate: view.sprint.startDate,
        endDate: view.sprint.endDate,
        reward: own,
        defaultReward: db.defaultReward.value,
        effectiveReward: own ?? db.defaultReward.value,
      })
    }

    const { data } = await http.put<SprintRewardDto>(`/sprints/${ROUTE[which]}/recompensa`, {
      recompensa: normalizeReward(reward),
    })
    return toSprintReward(data)
  },

  /** Recompensa padrão do usuário, usada nos sprints sem recompensa própria. */
  async getDefaultReward(): Promise<string | null> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(db.defaultReward.value)
    }

    const { data } = await http.get<DefaultRewardDto>('/sprints/recompensa-padrao')
    return data.recompensaPadrao
  },

  async setDefaultReward(reward: string | null): Promise<string | null> {
    if (USE_MOCK) {
      const db = await mockDb()
      const text = normalizeReward(reward)
      if (text && text.length > REWARD_MAX_LENGTH) {
        throw new Error(`A recompensa deve ter no máximo ${REWARD_MAX_LENGTH} caracteres.`)
      }
      db.defaultReward.value = text
      return delay(text)
    }

    const { data } = await http.put<DefaultRewardDto>('/sprints/recompensa-padrao', {
      recompensaPadrao: normalizeReward(reward),
    })
    return data.recompensaPadrao
  },

  /** Devolve a tarefa ao backlog (mantém o dia). */
  async removeTask(taskId: string): Promise<Task> {
    if (USE_MOCK) {
      const db = await mockDb()
      const task = findTask(db, taskId)
      assertInSprint(task)
      assertUnlocked(task)
      task.sprintId = null
      return delay(db.clone(task))
    }

    const { data } = await http.delete<TaskDto>(`/sprints/tarefas/${taskId}`)
    return toTask(data)
  },
}
