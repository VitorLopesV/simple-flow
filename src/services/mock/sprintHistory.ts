import type { SprintHistoryEntry, SprintHistoryTask, SprintTaskOutcome } from '@/types/sprint'
import { addDays } from '@/utils/sprint'

const ROUTINE_DAY_POINTS = 40
const TASK_POINTS = 30
const LATE_TASK_POINTS = 6
const SPRINTS_IN_HISTORY = 12

/** Quatro formatos de semana que se repetem: bônus cheio, bônus com atraso, fraca e mediana. */
const VARIANTS: { routineDays: number; outcomes: SprintTaskOutcome[] }[] = [
  { routineDays: 5, outcomes: ['CONCLUIDA', 'CONCLUIDA', 'CONCLUIDA'] },
  { routineDays: 5, outcomes: ['CONCLUIDA', 'CONCLUIDA', 'ATRASADA'] },
  { routineDays: 3, outcomes: ['CONCLUIDA', 'ATRASADA', 'NAO_CONCLUIDA'] },
  { routineDays: 4, outcomes: ['CONCLUIDA', 'CONCLUIDA', 'NAO_CONCLUIDA'] },
]

const ROUTINE_ITEMS = [
  { name: 'Treinar', time: '07:00' },
  { name: 'Ler 20 minutos', time: null },
]

function earnedPoints(outcome: SprintTaskOutcome): number {
  if (outcome === 'CONCLUIDA') return TASK_POINTS
  return outcome === 'ATRASADA' ? LATE_TASK_POINTS : 0
}

/**
 * Sprints fechados fictícios, do mais recente ao mais antigo, como `GET /sprints/historico`
 * (a foto gravada no fechamento). Determinístico: depende só da segunda-feira do sprint atual.
 */
export function buildSprintHistory(currentMonday: string): SprintHistoryEntry[] {
  return Array.from({ length: SPRINTS_IN_HISTORY }, (_, index) => {
    const startDate = addDays(currentMonday, -7 * (index + 1))
    const variant = VARIANTS[index % VARIANTS.length]
    const reward = index % 2 === 0 ? 'Pedir pizza' : null

    const tasks: SprintHistoryTask[] = variant.outcomes.map((outcome, position) => ({
      id: `tar_hist_${index}_${position}`,
      title: `Tarefa ${position + 1} da semana`,
      day: addDays(startDate, position),
      time: position === 0 ? '09:00' : null,
      estimateMinutes: 60,
      difficulty: 'MEDIA',
      priority: 'ALTA',
      points: TASK_POINTS,
      earnedPoints: earnedPoints(outcome),
      outcome,
    }))

    const routineTotal = 5 * ROUTINE_DAY_POINTS
    const routineDone = variant.routineDays * ROUTINE_DAY_POINTS
    const tasksTotal = tasks.length * TASK_POINTS
    const tasksDone = tasks.reduce((sum, task) => sum + task.earnedPoints, 0)
    const total = routineTotal + tasksTotal
    const done = routineDone + tasksDone
    // Comparação em inteiros, como o backend: nunca pelo percentual arredondado.
    const bonus = total > 0 && done * 10 >= total * 9

    return {
      sprintId: `spr_${startDate}`,
      startDate,
      endDate: addDays(startDate, 4),
      closedAt: `${addDays(startDate, 5)}T03:00:00.000Z`,
      total,
      done,
      percentage: Math.round((done / total) * 1000) / 10,
      bonus,
      reward,
      rewardEarned: bonus && reward !== null,
      routine: {
        daysWithRoutine: 5,
        daysCompleted: variant.routineDays,
        pointsPerDay: ROUTINE_DAY_POINTS,
        total: routineTotal,
        done: routineDone,
        days: Array.from({ length: 5 }, (_, day) => ({
          date: addDays(startDate, day),
          completed: day < variant.routineDays,
          items: ROUTINE_ITEMS.map((item) => ({ ...item, completed: day < variant.routineDays })),
        })),
      },
      tasks: {
        count: tasks.length,
        completed: tasks.filter((task) => task.outcome !== 'NAO_CONCLUIDA').length,
        total: tasksTotal,
        done: tasksDone,
        late: tasks.filter((task) => task.outcome === 'ATRASADA').length,
        notCompleted: tasks.filter((task) => task.outcome === 'NAO_CONCLUIDA').length,
        items: tasks,
      },
    }
  })
}
