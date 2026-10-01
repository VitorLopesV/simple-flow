import type { Paginated, Period, SeriesChangeOptions } from '@/types/common'
import type { IncomeDto, IncomeSummaryDto } from '@/types/dto'
import type { Income, IncomeFilter, IncomePayload, IncomeSummary } from '@/types/income'
import { addMonths, isWithinPeriod, toReferenceMonth } from '@/utils/dateFormatter'
import { asEditedMonthsError, EditedMonthsError, http, USE_MOCK } from './http'
import { mapPage, toIncome, toIncomePayloadDto, toIncomeSummary } from './mappers'
import { delay, matchesSearch, mockDb, paginate } from './mock'

export const incomeService = {
  async list(filter: IncomeFilter): Promise<Paginated<Income>> {
    if (USE_MOCK) {
      const db = await mockDb()
      const found = db.incomes
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
        db.incomes
          .filter((income) => isWithinPeriod(income.date, target))
          .reduce((sum, income) => sum + income.amount, 0)

      const inPeriod = db.incomes.filter((income) => isWithinPeriod(income.date, period))
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
      // Mesmas regras do backend: recorrência só em Renda Fixa, e criar um registro
      // recorrente já cria o do mês seguinte (registro próprio, mesma série).
      if (payload.recurring && !db.isFixedCategoryId(payload.categoryId)) {
        throw new Error(db.RECURRING_ONLY_FIXED)
      }

      const income: Income = {
        ...payload,
        seriesId: payload.recurring ? db.newId('ser') : null,
        id: db.newId('ent'),
        createdAt: db.now(),
        updatedAt: db.now(),
      }
      db.incomes.push(income)
      db.ensureNextIncome(income)
      return delay(db.clone(income))
    }

    const { data } = await http.post<IncomeDto>('/entradas', toIncomePayloadDto(payload))
    return toIncome(data)
  },

  /**
   * Desligar a recorrência remove os meses seguintes da série; se algum foi alterado, só
   * remove com `options.confirm` (senão rejeita com `EditedMonthsError`, sem salvar nada).
   */
  async update(id: string, payload: IncomePayload, options: SeriesChangeOptions = {}): Promise<Income> {
    if (USE_MOCK) {
      const db = await mockDb()
      const index = db.incomes.findIndex((income) => income.id === id)
      if (index < 0) throw new Error('Entrada não encontrada.')

      const current = db.incomes[index]!
      // Trocar para uma categoria não fixa conta como desligar a recorrência.
      const recurring = payload.recurring && db.isFixedCategoryId(payload.categoryId)
      // Nome de uma entrada recorrente é imutável — só muda quando ela deixa de ser recorrente.
      const description = current.recurring && recurring ? current.description : payload.description

      const deactivating = current.recurring && !recurring
      const edited = deactivating ? db.editedLaterMonths(db.incomes, current) : []
      if (edited.length && !options.confirm) throw new EditedMonthsError(edited)

      const updated: Income = {
        ...current,
        ...payload,
        recurring,
        description,
        // Religar a recorrência mantém a série original (ou abre uma, se nunca teve).
        seriesId: current.seriesId ?? (recurring ? db.newId('ser') : null),
        manuallyEdited: true,
        updatedAt: db.now(),
      }
      db.incomes[index] = updated

      // Desligar encerra a série a partir do mês seguinte; religar volta a gerar o próximo mês.
      if (deactivating) db.removeRecords(db.incomes, db.laterInSeries(db.incomes, current))
      if (!current.recurring && recurring) db.ensureNextIncome(updated)

      return delay(db.clone(updated))
    }

    try {
      const { data } = await http.put<IncomeDto>(`/entradas/${id}`, toIncomePayloadDto(payload), {
        params: { confirmar: options.confirm || undefined },
      })
      return toIncome(data)
    } catch (error) {
      throw asEditedMonthsError(error)
    }
  },

  /** Remove o mês e os seguintes da série; meses seguintes alterados exigem `options.confirm`. */
  async remove(id: string, options: SeriesChangeOptions = {}): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const income = db.incomes.find((item) => item.id === id)
      if (!income) throw new Error('Entrada não encontrada.')

      const edited = db.editedLaterMonths(db.incomes, income)
      if (edited.length && !options.confirm) throw new EditedMonthsError(edited)
      // Excluir um mês da série remove ele e os seguintes; os anteriores ficam intactos.
      db.removeRecords(db.incomes, [income, ...db.laterInSeries(db.incomes, income)])
      return delay(undefined)
    }

    try {
      await http.delete(`/entradas/${id}`, { params: { confirmar: options.confirm || undefined } })
    } catch (error) {
      throw asEditedMonthsError(error)
    }
  },
}
