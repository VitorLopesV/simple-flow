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
      if (destination?.action === 'move' && !db.areas.some((area) => area.id === destination.targetAreaId)) {
        throw new Error('Área de destino inválida.')
      }

      // As tarefas só passam a existir na próxima issue; aqui só sai a área.
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
