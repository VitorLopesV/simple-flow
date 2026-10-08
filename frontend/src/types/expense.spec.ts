import { afterEach, describe, expect, it, vi } from 'vitest'

import { EXPENSE_STATUS_OPTIONS, isExpenseOverdue } from '@/types/expense'

const TODAY = '2026-10-08'

afterEach(() => vi.useRealTimers())

describe('isExpenseOverdue', () => {
  it('pendente com vencimento anterior a hoje está vencida', () => {
    expect(isExpenseOverdue({ status: 'PENDENTE', dueDate: '2026-10-07' }, TODAY)).toBe(true)
    expect(isExpenseOverdue({ status: 'PENDENTE', dueDate: '2025-12-31' }, TODAY)).toBe(true)
  })

  it('pendente que vence hoje ou no futuro não está vencida', () => {
    expect(isExpenseOverdue({ status: 'PENDENTE', dueDate: TODAY }, TODAY)).toBe(false)
    expect(isExpenseOverdue({ status: 'PENDENTE', dueDate: '2026-10-09' }, TODAY)).toBe(false)
  })

  it('sem vencimento nunca vence', () => {
    expect(isExpenseOverdue({ status: 'PENDENTE', dueDate: null }, TODAY)).toBe(false)
    expect(isExpenseOverdue({ status: 'PENDENTE', dueDate: undefined }, TODAY)).toBe(false)
    expect(isExpenseOverdue({ status: 'PENDENTE', dueDate: '' }, TODAY)).toBe(false)
  })

  it('paga continua paga, mesmo com o vencimento passado', () => {
    expect(isExpenseOverdue({ status: 'PAGO', dueDate: '2026-10-01' }, TODAY)).toBe(false)
  })

  it('usa a data local de hoje quando `today` não é informado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 8, 0, 30))

    expect(isExpenseOverdue({ status: 'PENDENTE', dueDate: '2026-10-07' })).toBe(true)
    expect(isExpenseOverdue({ status: 'PENDENTE', dueDate: '2026-10-08' })).toBe(false)
  })
})

describe('situações selecionáveis', () => {
  it('são só Pendente e Pago — "Vencido" é derivado, não uma opção', () => {
    expect(EXPENSE_STATUS_OPTIONS.map((option) => option.value)).toEqual(['PENDENTE', 'PAGO'])
  })
})
