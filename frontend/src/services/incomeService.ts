import type { Paginated, Period } from '@/types/common'
import type { IncomeDto, IncomeSummaryDto } from '@/types/dto'
import type { Income, IncomeFilter, IncomePayload, IncomeSummary } from '@/types/income'
import { addMonths, isWithinPeriod, toReferenceMonth } from '@/utils/dateFormatter'
import { http, USE_MOCK } from './http'
import { mapPage, toIncome, toIncomePayloadDto, toIncomeSummary } from './mappers'
import { delay, matchesSearch, mockDb, paginate } from './mock'

export const incomeService = {
  async list(filter: IncomeFilter): Promise<Paginated<Income>> {
    if (USE_MOCK) {
      const db = await mockDb()
      const found = db
        .withRecurrences(db.incomes, filter.period)
        .filter((income) => isWithinPeriod(income.date, filter.period))
        .filter((income) => !filter.categoryId || income.categoryId === filter.categoryId)
        .filter((income) => !filter.type || income.type === filter.type)
        .filter((income) => matchesSearch(`${income.description} ${income.notes ?? ''}`, filter.search))
        .sort((a, b) => b.date.localeCompare(a.date))

      return delay(paginate(db.clone(found), filter))
    }

    const { data } = await http.get<Paginated<IncomeDto>>('/entradas', {
      params: {
        mes: filter.period.month,
        ano: filter.period.year,
        categoriaId: filter.categoryId ?? undefined,
        tipo: filter.type ?? undefined,
        busca: filter.search || undefined,
        page: filter.page,
        pageSize: filter.pageSize,
      },
    })
    return mapPage(data, toIncome)
  },

  async summary(period: Period): Promise<IncomeSummary> {
    if (USE_MOCK) {
      const db = await mockDb()

      const periodTotal = (target: Period) =>
        db
          .withRecurrences(db.incomes, target)
          .filter((income) => isWithinPeriod(income.date, target))
          .reduce((sum, income) => sum + income.amount, 0)

      const inPeriod = db
        .withRecurrences(db.incomes, period)
        .filter((income) => isWithinPeriod(income.date, period))
      const total = inPeriod.reduce((sum, income) => sum + income.amount, 0)

      const grouped = new Map<string, number>()
      for (const income of inPeriod) {
        grouped.set(income.categoryId, (grouped.get(income.categoryId) ?? 0) + income.amount)
      }

      const byCategory = [...grouped.entries()]
        .map(([categoryId, amount]) => {
          const category = db.categories.find((item) => item.id === categoryId)
          return {
            categoryId,
            name: category?.name ?? 'Sem categoria',
            color: category?.color ?? '#94a3b8',
            total: amount,
          }
        })
        .sort((a, b) => b.total - a.total)

      return delay({
        total,
        count: inPeriod.length,
        average: inPeriod.length ? total / inPeriod.length : 0,
        previousMonthTotal: periodTotal(addMonths(period, -1)),
        byCategory,
      })
    }

    const { data } = await http.get<IncomeSummaryDto>('/entradas/resumo', {
      params: { competencia: toReferenceMonth(period) },
    })
    return toIncomeSummary(data)
  },

  async create(payload: IncomePayload): Promise<Income> {
    if (USE_MOCK) {
      const db = await mockDb()
      const income: Income = {
        ...payload,
        id: db.newId('ent'),
        createdAt: db.now(),
        updatedAt: db.now(),
      }
      db.incomes.push(income)
      return delay(db.clone(income))
    }

    const { data } = await http.post<IncomeDto>('/entradas', toIncomePayloadDto(payload))
    return toIncome(data)
  },

  async update(id: string, payload: IncomePayload): Promise<Income> {
    if (USE_MOCK) {
      const db = await mockDb()
      const index = db.incomes.findIndex((income) => income.id === id)

      if (index < 0) {
        // Ocorrência projetada de uma recorrência (id sintético, nunca persistido —
        // ver `withRecurrences`): editá-la materializa uma linha própria para este
        // mês, independente das demais, em vez de mudar o lançamento original.
        const projected = db.parseProjectedId(id)
        const origin = projected && db.incomes.find((income) => income.id === projected.originId)
        if (!origin?.recurring) throw new Error('Entrada não encontrada.')

        const created: Income = {
          ...payload,
          // Nome vem sempre do lançamento original (ver AtualizarEntrada no
          // backend): as ocorrências de uma série só continuam casando pela mesma chave.
          description: origin.description,
          id: db.newId('ent'),
          createdAt: db.now(),
          updatedAt: db.now(),
        }
        db.incomes.push(created)
        return delay(db.clone(created))
      }

      const current = db.incomes[index]!
      // Nome de uma entrada recorrente é fixo entre suas ocorrências (ver acima) —
      // só aceita mudança de descrição quando a entrada deixa de ser recorrente.
      const description = current.recurring && payload.recurring ? current.description : payload.description

      const updated: Income = { ...current, ...payload, description, updatedAt: db.now() }
      db.incomes[index] = updated
      return delay(db.clone(updated))
    }

    const { data } = await http.put<IncomeDto>(`/entradas/${id}`, toIncomePayloadDto(payload))
    return toIncome(data)
  },

  async remove(id: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const index = db.incomes.findIndex((income) => income.id === id)
      if (index < 0) throw new Error('Entrada não encontrada.')
      db.incomes.splice(index, 1)
      return delay(undefined)
    }

    await http.delete(`/entradas/${id}`)
  },
}
