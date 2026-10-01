import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { mockDb } from '@/services/mock'
import { periodService } from '@/services/periodService'
import { addMonths, currentPeriod } from '@/utils/dateFormatter'

type Db = Awaited<ReturnType<typeof mockDb>>

let db: Db
let backup: { incomes: Db['incomes']; expenses: Db['expenses']; cardTransactions: Db['cardTransactions'] }

beforeEach(async () => {
  db = await mockDb()
  backup = {
    incomes: [...db.incomes],
    expenses: [...db.expenses],
    cardTransactions: [...db.cardTransactions],
  }
  db.incomes.length = 0
  db.expenses.length = 0
  db.cardTransactions.length = 0
})

afterEach(() => {
  db.incomes.splice(0, db.incomes.length, ...backup.incomes)
  db.expenses.splice(0, db.expenses.length, ...backup.expenses)
  db.cardTransactions.splice(0, db.cardTransactions.length, ...backup.cardTransactions)
})

describe('limits (mock)', () => {
  it('sem dados: do mês atual ao mês atual +1', async () => {
    const result = await periodService.limits()

    expect(result).toEqual({ firstMonth: currentPeriod(), lastMonth: addMonths(currentPeriod(), 1) })
  })

  it('o primeiro mês é o registro mais antigo entre entradas, saídas e cartões', async () => {
    db.incomes.push({ ...backup.incomes[0]!, date: '2026-03-10' })
    db.expenses.push({ ...backup.expenses[0]!, date: '2026-02-20' })
    db.cardTransactions.push({ ...backup.cardTransactions[0]!, date: '2026-01-05' })

    const result = await periodService.limits()

    expect(result.firstMonth).toEqual({ month: 1, year: 2026 })
  })

  it('um novo registro mais antigo antecipa o limite inferior', async () => {
    db.incomes.push({ ...backup.incomes[0]!, date: '2026-03-10' })
    expect((await periodService.limits()).firstMonth).toEqual({ month: 3, year: 2026 })

    db.expenses.push({ ...backup.expenses[0]!, date: '2025-11-02' })

    expect((await periodService.limits()).firstMonth).toEqual({ month: 11, year: 2025 })
  })
})
