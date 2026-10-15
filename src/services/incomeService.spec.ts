import { beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { mockDb } from '@/services/mock'
import { incomeService } from '@/services/incomeService'
import type { Income, IncomeFilter } from '@/types/income'

type Db = Awaited<ReturnType<typeof mockDb>>

let db: Db
let fixedIncome: string
let variableIncome: string

let sequence = 0

function income(overrides: Partial<Income> = {}): Income {
  sequence += 1
  return {
    id: `ent_teste_${sequence}`,
    description: 'Entrada',
    amount: 100,
    date: '2026-08-10',
    categoryId: fixedIncome,
    type: 'SALARIO',
    recurring: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function filter(overrides: Partial<IncomeFilter> = {}): IncomeFilter {
  return { period: { month: 8, year: 2026 }, page: 1, pageSize: 50, ...overrides }
}

function categoryId(name: string): string {
  const found = db.categories.find((category) => category.name === name)
  if (!found) throw new Error(`Categoria ausente: ${name}`)
  return found.id
}

/** Cópia da semente, tirada antes do primeiro teste limpar a lista. */
let seedIncomes: Income[] = []

beforeEach(async () => {
  db = await mockDb()
  if (!seedIncomes.length) seedIncomes = structuredClone(db.incomes)
  db.incomes.length = 0
  fixedIncome = categoryId('Renda Fixa')
  variableIncome = categoryId('Renda Variável')
})

describe('categorias de entrada (mock)', () => {
  it('são exatamente os 4 grupos: Renda Fixa, Renda Variável, Investimentos e Outros', () => {
    const names = db.categories
      .filter((category) => category.movement === 'ENTRADA')
      .map((category) => category.name)

    expect(names).toEqual(['Renda Fixa', 'Renda Variável', 'Investimentos', 'Outros'])
  })

  it('toda entrada semeada tem uma categoria de entrada e um tipo', () => {
    const incomeCategories = new Set(
      db.categories.filter((category) => category.movement === 'ENTRADA').map((category) => category.id),
    )

    expect(seedIncomes.length).toBeGreaterThan(0)
    for (const item of seedIncomes) {
      expect(incomeCategories.has(item.categoryId)).toBe(true)
      expect(['SALARIO', 'FREELANCE', 'RENDIMENTOS', 'REEMBOLSO']).toContain(item.type)
    }
  })

  it('o salário semeado fica em Renda Fixa / Salário', () => {
    const salary = seedIncomes.find((item) => item.description === 'Salário mensal')

    expect(salary).toMatchObject({ categoryId: categoryId('Renda Fixa'), type: 'SALARIO' })
  })
})

describe('list (mock)', () => {
  it('filtra por tipo', async () => {
    db.incomes.push(
      income({ id: 'a', type: 'SALARIO' }),
      income({ id: 'b', type: 'FREELANCE', categoryId: variableIncome }),
    )

    const result = await incomeService.list(filter({ type: 'FREELANCE' }))

    expect(result.items.map((item) => item.id)).toEqual(['b'])
  })

  it('filtra por categoria e tipo juntos', async () => {
    db.incomes.push(
      income({ id: 'a', type: 'FREELANCE' }),
      income({ id: 'b', type: 'FREELANCE', categoryId: variableIncome }),
      income({ id: 'c', type: 'SALARIO', categoryId: variableIncome }),
    )

    const result = await incomeService.list(filter({ categoryId: variableIncome, type: 'FREELANCE' }))

    expect(result.items.map((item) => item.id)).toEqual(['b'])
  })
})

describe('create / update (mock)', () => {
  it('guarda categoria e tipo da entrada', async () => {
    const created = await incomeService.create({
      description: 'Projeto',
      amount: 1500,
      date: '2026-08-12',
      categoryId: variableIncome,
      type: 'FREELANCE',
      recurring: false,
    })

    expect(created).toMatchObject({ categoryId: variableIncome, type: 'FREELANCE' })
    expect(db.incomes.find((item) => item.id === created.id)?.type).toBe('FREELANCE')
  })

  it('trocar o tipo na edição reflete na listagem', async () => {
    db.incomes.push(income({ id: 'x', type: 'FREELANCE', categoryId: variableIncome }))

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = db.incomes[0]!
    await incomeService.update('x', { ...rest, type: 'REEMBOLSO' })

    const result = await incomeService.list(filter())
    expect(result.items[0]?.type).toBe('REEMBOLSO')
  })
})

describe('summary (mock)', () => {
  it('agrupa pela categoria e a soma bate com o total', async () => {
    db.incomes.push(
      income({ amount: 100 }),
      income({ amount: 50, categoryId: variableIncome, type: 'FREELANCE' }),
      income({ amount: 25, categoryId: variableIncome, type: 'FREELANCE' }),
    )

    const summary = await incomeService.summary({ month: 8, year: 2026 })

    expect(summary.total).toBe(175)
    expect(summary.byCategory).toEqual([
      expect.objectContaining({ name: 'Renda Fixa', total: 100 }),
      expect.objectContaining({ name: 'Renda Variável', total: 75 }),
    ])
    expect(summary.byCategory.reduce((sum, item) => sum + item.total, 0)).toBe(summary.total)
  })
})

describe('recorrência com registros reais (mock)', () => {
  it('criar Renda Fixa recorrente cria também o mês seguinte', async () => {
    const created = await incomeService.create({
      description: 'Salário',
      amount: 7000,
      date: '2026-08-05',
      categoryId: fixedIncome,
      type: 'SALARIO',
      recurring: true,
    })

    expect(db.incomes.map((item) => item.date)).toEqual(['2026-08-05', '2026-09-05'])
    expect(db.incomes[1]!.seriesId).toBe(created.seriesId)
  })

  it('recorrente fora de Renda Fixa é recusada', async () => {
    await expect(
      incomeService.create({
        description: 'Freela',
        amount: 100,
        date: '2026-08-05',
        categoryId: variableIncome,
        type: 'FREELANCE',
        recurring: true,
      }),
    ).rejects.toThrow('Lançamento recorrente só é permitido em Renda Fixa ou Despesa Fixa.')
  })

  it('excluir remove o mês e os seguintes; desligar remove só os seguintes', async () => {
    db.incomes.push(
      income({ id: 'jul', date: '2026-07-05', recurring: true, seriesId: 's' }),
      income({ id: 'ago', date: '2026-08-05', recurring: true, seriesId: 's' }),
      income({ id: 'set', date: '2026-09-05', recurring: true, seriesId: 's' }),
    )

    await incomeService.update('jul', {
      description: 'Entrada',
      amount: 100,
      date: '2026-07-05',
      categoryId: fixedIncome,
      type: 'SALARIO',
      recurring: false,
    })
    expect(db.incomes.map((item) => item.id)).toEqual(['jul'])

    db.incomes.push(
      income({ id: 'a2', date: '2026-08-05', recurring: true, seriesId: 't' }),
      income({ id: 'b2', date: '2026-09-05', recurring: true, seriesId: 't' }),
    )
    await incomeService.remove('a2')
    expect(db.incomes.map((item) => item.id)).toEqual(['jul'])
  })

  it('a data salva na edição é a do próprio registro', async () => {
    db.incomes.push(income({ id: 'set', date: '2026-09-05', recurring: true, seriesId: 's' }))

    const updated = await incomeService.update('set', {
      description: 'Entrada',
      amount: 300,
      date: '2026-09-05',
      categoryId: fixedIncome,
      type: 'SALARIO',
      recurring: true,
    })

    expect(updated.date).toBe('2026-09-05')
  })
})
