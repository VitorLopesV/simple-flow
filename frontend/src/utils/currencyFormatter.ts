/** Formatação e parsing de valores monetários em BRL. */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const percent = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** `1234.5` -> `R$ 1.234,50` */
export function formatCurrency(value: number | null | undefined): string {
  return brl.format(Number(value ?? 0))
}

/** `1234567` -> `R$ 1,2 mi`. Usado em eixos de gráfico e cards estreitos. */
export function formatCurrencyCompact(value: number | null | undefined): string {
  return brlCompact.format(Number(value ?? 0))
}

/** `0.1234` -> `12,3%`. Recebe a fração, não o percentual. */
export function formatPercent(fraction: number | null | undefined): string {
  return percent.format(Number(fraction ?? 0))
}

/** Variação percentual entre dois valores, protegida contra divisão por zero. */
export function calculateChange(current: number, previous: number): number {
  if (!previous) return current > 0 ? 1 : 0
  return (current - previous) / Math.abs(previous)
}

/**
 * Converte o texto digitado pelo usuário em número.
 * Aceita `1.234,56`, `1234,56`, `1234.56` e `R$ 1.234,56`.
 * Ponto sem vírgula em grupos de 3 dígitos é milhar (`1.234` -> `1234`).
 */
export function parseCurrency(text: string | number | null | undefined): number {
  if (typeof text === 'number') return text
  if (!text) return 0

  const clean = String(text).replace(/[^\d,.-]/g, '')
  if (!clean) return 0

  const lastComma = clean.lastIndexOf(',')
  const lastDot = clean.lastIndexOf('.')

  let normalized: string
  if (lastComma > lastDot) {
    // Formato pt-BR: ponto é separador de milhar, vírgula é decimal.
    normalized = clean.replace(/\./g, '').replace(',', '.')
  } else if (lastComma === -1 && /^-?\d{1,3}(\.\d{3})+$/.test(clean)) {
    // Só pontos em grupos de 3 dígitos (`1.234`, `1.234.567`): milhar, não decimal.
    normalized = clean.replace(/\./g, '')
  } else {
    normalized = clean.replace(/,/g, '')
  }

  const number = Number.parseFloat(normalized)
  return Number.isFinite(number) ? number : 0
}

/** Número puro com 2 casas, para preencher inputs de edição (`1234.5` -> `1.234,50`). */
export function formatDecimal(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}
