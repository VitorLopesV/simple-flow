import type { NavigationLimitsDto } from '@/types/dto'
import type { NavigationLimits } from '@/types/period'
import { addMonths, currentPeriod } from '@/utils/dateFormatter'
import { http, USE_MOCK } from './http'
import { toNavigationLimits } from './mappers'
import { delay, mockDb } from './mock'

export const periodService = {
  /** Do primeiro mês com dados do usuário até o mês atual +1 (regra dinâmica, pelo relógio). */
  async limits(): Promise<NavigationLimits> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay({ firstMonth: db.firstRecordMonth(), lastMonth: addMonths(currentPeriod(), 1) })
    }

    const { data } = await http.get<NavigationLimitsDto>('/competencias/limites')
    return toNavigationLimits(data)
  },
}
