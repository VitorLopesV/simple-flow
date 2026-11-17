import type { Area, AreaPayload, AreaTasksDestination } from '@/types/area'
import type { AreaDto } from '@/types/dto'
import { http, USE_MOCK } from './http'
import { toArea, toAreaPayloadDto } from './mappers'
import { delay, mockDb } from './mock'

export const areaService = {
  /** A Rotina vem primeiro; as demais seguem em ordem alfabética. */
  async list(): Promise<Area[]> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(
        db
          .clone(db.areas)
          .sort((a, b) => Number(b.system) - Number(a.system) || a.name.localeCompare(b.name, 'pt-BR')),
      )
    }

    const { data } = await http.get<AreaDto[]>('/areas')
    return data.map(toArea)
  },

  async create(payload: AreaPayload): Promise<Area> {
    if (USE_MOCK) {
      const db = await mockDb()
      assertUniqueName(db.areas, payload.name)
      const area: Area = { ...payload, id: db.newId('are'), system: false, createdAt: db.now() }
      db.areas.push(area)
      return delay(db.clone(area))
    }

    const { data } = await http.post<AreaDto>('/areas', toAreaPayloadDto(payload))
    return toArea(data)
  },

  async update(id: string, payload: AreaPayload): Promise<Area> {
    if (USE_MOCK) {
      const db = await mockDb()
      const index = db.areas.findIndex((area) => area.id === id)
      if (index < 0) throw new Error('Área não encontrada.')

      const current = db.areas[index]!
      // A Rotina é protegida inteira pelo backend: nem nome nem cor mudam.
      if (current.system) throw new Error('A área Rotina não pode ser editada.')
      assertUniqueName(db.areas, payload.name, id)

      const updated: Area = { ...current, ...payload }
      db.areas[index] = updated
      return delay(db.clone(updated))
    }

    const { data } = await http.put<AreaDto>(`/areas/${id}`, toAreaPayloadDto(payload))
    return toArea(data)
  },

  /**
   * Sem `destination`, só exclui áreas sem tarefas. Com ela, move as tarefas para
   * outra área ou as exclui junto.
   */
  async remove(id: string, destination?: AreaTasksDestination): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const index = db.areas.findIndex((area) => area.id === id)
      if (index < 0) throw new Error('Área não encontrada.')
      if (db.areas[index]!.system) throw new Error('A área Rotina não pode ser excluída.')
      const target = destination?.action === 'move' ? db.areas.find((area) => area.id === destination.targetAreaId) : null
      if (destination?.action === 'move' && !target) {
        throw new Error('Área de destino inválida.')
      }
      if (target?.system) {
        throw new Error('A área Rotina não aceita tarefas.')
      }

      const areaTasks = db.tasks.filter((task) => task.areaId === id)
      if (areaTasks.length && !destination) {
        throw new Error('A área tem tarefas: escolha mover ou excluir.')
      }
      // As Super tasks da área seguem o mesmo destino das tarefas.
      const areaSuperTasks = db.superTasks.filter((item) => item.areaId === id)
      if (areaSuperTasks.length && !destination) {
        throw new Error('A área tem tarefas: escolha mover ou excluir.')
      }
      if (destination?.action === 'move') {
        areaTasks.forEach((task) => (task.areaId = destination.targetAreaId))
        areaSuperTasks.forEach((item) => (item.areaId = destination.targetAreaId))
      } else {
        db.tasks.splice(0, db.tasks.length, ...db.tasks.filter((task) => task.areaId !== id))
        db.superTasks.splice(0, db.superTasks.length, ...db.superTasks.filter((item) => item.areaId !== id))
      }

      db.areas.splice(index, 1)
      return delay(undefined)
    }

    await http.delete(`/areas/${id}`, {
      params:
        destination?.action === 'move'
          ? { tarefas: 'mover', destinoId: destination.targetAreaId }
          : destination?.action === 'delete'
            ? { tarefas: 'excluir' }
            : undefined,
    })
  },
}

/** O backend barra nomes repetidos (sem diferenciar maiúsculas), inclusive "Rotina". */
function assertUniqueName(areas: Area[], name: string, ignoreId?: string): void {
  const normalized = name.trim().toLowerCase()
  if (areas.some((area) => area.id !== ignoreId && area.name.trim().toLowerCase() === normalized)) {
    throw new Error('Já existe uma área com esse nome.')
  }
}
