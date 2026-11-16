import type { RoutineItemDto } from '@/types/dto'
import type { RoutineItem, RoutinePayload } from '@/types/routine'
import { ROUTINE_MAX_INTERVAL, ROUTINE_MAX_TIMES } from '@/types/routine'
import { http, USE_MOCK } from './http'
import { toRoutineItem, toRoutinePayloadDto } from './mappers'
import { delay, mockDb } from './mock'

type Db = Awaited<ReturnType<typeof mockDb>>

function findItem(db: Db, id: string): RoutineItem {
  const item = db.routineItems.find((entry) => entry.id === id)
  if (!item) throw new Error('Item de rotina não encontrado.')
  return item
}

/** Mesmas regras do backend, para o mock não aceitar o que a API recusaria. */
function assertValid(payload: RoutinePayload): void {
  if (!payload.name.trim()) throw new Error('Informe o nome do item.')
  if (payload.repeat.mode === 'DIAS_DA_SEMANA' && payload.repeat.days.length === 0) {
    throw new Error('Marque ao menos um dia da semana.')
  }
  if (
    payload.repeat.mode === 'A_CADA_N_DIAS' &&
    (!Number.isInteger(payload.repeat.interval) ||
      payload.repeat.interval < 1 ||
      payload.repeat.interval > ROUTINE_MAX_INTERVAL)
  ) {
    throw new Error(`O intervalo deve ficar entre 1 e ${ROUTINE_MAX_INTERVAL} dias.`)
  }
  if (payload.times.length < 1 || payload.times.length > ROUTINE_MAX_TIMES) {
    throw new Error(`Informe de 1 a ${ROUTINE_MAX_TIMES} vezes por dia.`)
  }
  const keys = payload.times.map((slot) => slot.time ?? '')
  if (new Set(keys).size !== keys.length) throw new Error('Há vezes repetidas no mesmo dia.')
}

/** Dias da semana sem duplicados e em ordem, como o backend devolve. */
function normalize(payload: RoutinePayload): RoutinePayload {
  const repeat =
    payload.repeat.mode === 'DIAS_DA_SEMANA'
      ? { ...payload.repeat, days: [...new Set(payload.repeat.days)].sort((a, b) => a - b) }
      : { ...payload.repeat }
  return { name: payload.name.trim(), repeat, times: payload.times.map((slot) => ({ time: slot.time })) }
}

export const routineService = {
  /** Em ordem alfabética, como o backend devolve. */
  async list(): Promise<RoutineItem[]> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(db.clone(db.routineItems).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    }

    const { data } = await http.get<RoutineItemDto[]>('/rotinas')
    return data.map(toRoutineItem)
  },

  /** O item vai sempre para a área Rotina do usuário. */
  async create(payload: RoutinePayload): Promise<RoutineItem> {
    if (USE_MOCK) {
      const db = await mockDb()
      assertValid(payload)
      const routineArea = db.areas.find((area) => area.system)
      const item: RoutineItem = {
        ...normalize(payload),
        id: db.newId('rot'),
        areaId: routineArea?.id ?? '',
        createdAt: db.now(),
      }
      db.routineItems.push(item)
      return delay(db.clone(item))
    }

    const { data } = await http.post<RoutineItemDto>('/rotinas', toRoutinePayloadDto(payload))
    return toRoutineItem(data)
  },

  /** Substitui o item inteiro. */
  async update(id: string, payload: RoutinePayload): Promise<RoutineItem> {
    if (USE_MOCK) {
      const db = await mockDb()
      const item = findItem(db, id)
      assertValid(payload)
      Object.assign(item, normalize(payload))
      return delay(db.clone(item))
    }

    const { data } = await http.put<RoutineItemDto>(`/rotinas/${id}`, toRoutinePayloadDto(payload))
    return toRoutineItem(data)
  },

  async remove(id: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      db.routineItems.splice(db.routineItems.indexOf(findItem(db, id)), 1)
      return delay(undefined)
    }

    await http.delete(`/rotinas/${id}`)
  },
}
