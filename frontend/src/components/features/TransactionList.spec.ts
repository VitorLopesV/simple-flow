import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TransactionList from '@/components/features/TransactionList.vue'
import type { Expense } from '@/types/expense'

function expense(id: string, overrides: Partial<Expense> = {}): Expense {
  return {
    id,
    description: `Saída ${id}`,
    amount: 100,
    date: '2026-10-02',
    categoryId: 'cat_1',
    type: 'CONTA',
    status: 'PENDENTE',
    dueDate: null,
    paidAt: null,
    paymentMethod: 'PIX',
    cardId: null,
    recurring: false,
    createdAt: '2026-10-02T12:00:00.000Z',
    updatedAt: '2026-10-02T12:00:00.000Z',
    ...overrides,
  }
}

/** Pré-requisito da issue, com "hoje" fixado em 08/10/2026. */
const ITEMS: Expense[] = [
  expense('yesterday', { dueDate: '2026-10-07' }),
  expense('today', { dueDate: '2026-10-08' }),
  expense('tomorrow', { dueDate: '2026-10-09' }),
  expense('no-due-date', { dueDate: null }),
  expense('paid-late', { status: 'PAGO', dueDate: '2026-10-01', paidAt: '2026-10-08' }),
]

let wrapper: VueWrapper | undefined

function mountComponent(items: Expense[] = ITEMS) {
  wrapper = mount(TransactionList, {
    props: { kind: 'SAIDA', items, page: 1, totalPages: 1, total: items.length, pageSize: 10 },
  })
  return wrapper
}

/** Elemento achado com `get` (o test-utils tira o `exists`, que seria sempre verdadeiro). */
type Found = Omit<DOMWrapper<Element>, 'exists'>

/** Badge de situação da saída na tabela (desktop) ou no card (mobile). */
function status(screen: VueWrapper, id: string, layout: 'table' | 'cards'): Found {
  const rows = screen.findAll(layout === 'table' ? 'tbody tr' : 'ul > li')
  const row = rows.find((item) => item.text().includes(`Saída ${id}`))
  if (!row) throw new Error(`Saída ${id} não encontrada (${layout})`)
  return row.get('[data-testid="expense-status"]')
}

function tone(badge: Found): string | undefined {
  const span = badge.element.tagName === 'BUTTON' ? badge.get('span') : badge
  return span.classes().find((name) => /^text-(danger|warning|success)$/.test(name))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 8, 12, 0))
  setActivePinia(createPinia())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe.each(['table', 'cards'] as const)('situação das saídas (%s)', (layout) => {
  it('pendente com vencimento ontem mostra "Vencido" em vermelho', () => {
    const screen = mountComponent()

    expect(status(screen, 'yesterday', layout).text()).toBe('Vencido')
    expect(tone(status(screen, 'yesterday', layout))).toBe('text-danger')
  })

  it('vencimento hoje ou amanhã continua "Pendente"', () => {
    const screen = mountComponent()

    for (const id of ['today', 'tomorrow']) {
      expect(status(screen, id, layout).text()).toBe('Pendente')
      expect(tone(status(screen, id, layout))).toBe('text-warning')
    }
  })

  it('sem vencimento continua "Pendente"', () => {
    const screen = mountComponent()

    expect(status(screen, 'no-due-date', layout).text()).toBe('Pendente')
  })

  it('paga com vencimento passado continua "Pago"', () => {
    const screen = mountComponent()

    expect(status(screen, 'paid-late', layout).text()).toBe('Pago')
    expect(tone(status(screen, 'paid-late', layout))).toBe('text-success')
  })

  it('clicar em "Vencido" pede para marcar como pago, como no fluxo atual', async () => {
    const screen = mountComponent()

    const badge = status(screen, 'yesterday', layout)
    expect(badge.element.tagName).toBe('BUTTON')
    expect(badge.attributes('title')).toBe('Marcar como pago')

    await badge.trigger('click')

    expect(screen.emitted('toggleStatus')).toEqual([[ITEMS[0]]])
  })

  it('pagar e voltar para pendente com o vencimento passado mostra "Vencido" na hora', async () => {
    const screen = mountComponent()
    const paidLate = ITEMS[4]!

    await screen.setProps({ items: [{ ...paidLate, status: 'PENDENTE', paidAt: null }] })

    expect(status(screen, 'paid-late', layout).text()).toBe('Vencido')
    expect(tone(status(screen, 'paid-late', layout))).toBe('text-danger')
    expect(status(screen, 'paid-late', layout).attributes('title')).toBe('Marcar como pago')
  })

  it('fatura de cartão vencida também aparece como "Vencido", sem ação', () => {
    const invoice = expense('invoice', { automatic: true, cardId: 'card_1', dueDate: '2026-10-03' })
    const screen = mountComponent([invoice])

    const badge = status(screen, 'invoice', layout)
    expect(badge.text()).toBe('Vencido')
    expect(badge.element.tagName).not.toBe('BUTTON')
  })
})
