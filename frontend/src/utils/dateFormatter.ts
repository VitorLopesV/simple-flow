/**
 * Helpers de data.
 *
 * Convenção: datas trafegam e são persistidas como `YYYY-MM-DD` (sem fuso).
 * Toda conversão para `Date` usa horário local ao meio-dia para evitar o
 * clássico off-by-one causado por UTC em fusos negativos como o do Brasil.
 */
import type { Period } from '@/types/common'

export const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

export const SHORT_MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

/** `'2026-08-15'` -> `Date` local (12h). */
export function toDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0)
}

/** `Date` -> `'2026-08-15'`. */
export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `'2026-08-15'` -> `'15/08/2026'`. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return toDate(iso).toLocaleDateString('pt-BR')
}

/** `'2026-08-15'` -> `'15/08/2026'`, vazio se não houver valor. Usado no texto editável do DateInput. */
export function toBrDateMask(iso: string | null | undefined): string {
  if (!iso) return ''
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return ''
  return `${day}/${month}/${year}`
}

/** Reaplica a máscara dd/mm/aaaa a cada tecla digitada, ignorando o que não for dígito. */
export function maskBrDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8)
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  return [day, month, year].filter(Boolean).join('/')
}

/** `'15/08/2026'` -> `'2026-08-15'`, ou `null` se a máscara ainda estiver incompleta/inválida. */
export function brDateToISO(masked: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked)
  if (!match) return null
  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

/** `'2026-08-15'` -> `'15 de ago.'`. */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = toDate(iso)
  return `${date.getDate()} de ${SHORT_MONTHS[date.getMonth()]?.toLowerCase()}.`
}

/** `{ month: 8, year: 2026 }` -> `'Agosto de 2026'`. */
export function formatPeriod(period: Period): string {
  return `${MONTHS[period.month - 1]} de ${period.year}`
}

/** `{ month: 8, year: 2026 }` -> `'2026-08'`. */
export function toReferenceMonth(period: Period): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}`
}

/** `'2026-08'` -> `{ month: 8, year: 2026 }`. */
export function fromReferenceMonth(referenceMonth: string): Period {
  const [year, month] = referenceMonth.split('-').map(Number)
  return { month: month ?? 1, year: year ?? new Date().getFullYear() }
}

export function currentPeriod(): Period {
  const today = new Date()
  return { month: today.getMonth() + 1, year: today.getFullYear() }
}

/** Soma (ou subtrai, com valor negativo) meses a um período. */
export function addMonths(period: Period, amount: number): Period {
  const total = period.year * 12 + (period.month - 1) + amount
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export function isSamePeriod(a: Period, b: Period): boolean {
  return a.month === b.month && a.year === b.year
}

/** Negativo se `a` vem antes de `b`, zero se é o mesmo mês, positivo se vem depois. */
export function comparePeriods(a: Period, b: Period): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}

/** Limita o período ao intervalo `[min, max]`; um limite ausente não restringe aquele lado. */
export function clampPeriod(period: Period, min?: Period | null, max?: Period | null): Period {
  if (min && comparePeriods(period, min) < 0) return { ...min }
  if (max && comparePeriods(period, max) > 0) return { ...max }
  return { ...period }
}

/** Verdadeiro se a data ISO cai dentro do período informado. */
export function isWithinPeriod(iso: string, period: Period): boolean {
  const date = toDate(iso)
  return date.getMonth() + 1 === period.month && date.getFullYear() === period.year
}

/** Último dia do mês do período (28-31). */
export function lastDayOfMonth(period: Period): number {
  return new Date(period.year, period.month, 0).getDate()
}

/** Data ISO de um dia dentro do período, limitada ao último dia do mês. */
export function dayInPeriod(period: Period, day: number): string {
  const safe = Math.min(day, lastDayOfMonth(period))
  return `${period.year}-${String(period.month).padStart(2, '0')}-${String(safe).padStart(2, '0')}`
}

/** Os `n` períodos que terminam em `period` (inclusive), do mais antigo ao mais recente. */
export function lastPeriods(period: Period, n: number): Period[] {
  return Array.from({ length: n }, (_, i) => addMonths(period, i - (n - 1)))
}

/** Rótulo curto para eixos de gráfico: `'ago/26'`. */
export function shortPeriodLabel(period: Period): string {
  return `${SHORT_MONTHS[period.month - 1]?.toLowerCase()}/${String(period.year).slice(-2)}`
}

/** Dias até o vencimento (negativo se já venceu). */
export function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const diff = toDate(iso).getTime() - today.getTime()
  return Math.round(diff / 86_400_000)
}
