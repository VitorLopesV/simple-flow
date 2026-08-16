/** Formatação e parsing de valores monetários em BRL. */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const brlCompacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const percentual = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** `1234.5` -> `R$ 1.234,50` */
export function formatCurrency(valor: number | null | undefined): string {
  return brl.format(Number(valor ?? 0))
}

/** `1234567` -> `R$ 1,2 mi`. Usado em eixos de gráfico e cards estreitos. */
export function formatCurrencyCompact(valor: number | null | undefined): string {
  return brlCompacto.format(Number(valor ?? 0))
}

/** `0.1234` -> `12,3%`. Recebe a fração, não o percentual. */
export function formatPercent(fracao: number | null | undefined): string {
  return percentual.format(Number(fracao ?? 0))
}

/** Variação percentual entre dois valores, protegida contra divisão por zero. */
export function calcularVariacao(atual: number, anterior: number): number {
  if (!anterior) return atual > 0 ? 1 : 0
  return (atual - anterior) / Math.abs(anterior)
}

/**
 * Converte o texto digitado pelo usuário em número.
 * Aceita `1.234,56`, `1234,56`, `1234.56` e `R$ 1.234,56`.
 */
export function parseCurrency(texto: string | number | null | undefined): number {
  if (typeof texto === 'number') return texto
  if (!texto) return 0

  const limpo = String(texto).replace(/[^\d,.-]/g, '')
  if (!limpo) return 0

  const ultimaVirgula = limpo.lastIndexOf(',')
  const ultimoPonto = limpo.lastIndexOf('.')

  let normalizado: string
  if (ultimaVirgula > ultimoPonto) {
    // Formato pt-BR: ponto é separador de milhar, vírgula é decimal.
    normalizado = limpo.replace(/\./g, '').replace(',', '.')
  } else {
    normalizado = limpo.replace(/,/g, '')
  }

  const numero = Number.parseFloat(normalizado)
  return Number.isFinite(numero) ? numero : 0
}

/** Número puro com 2 casas, para preencher inputs de edição (`1234.5` -> `1.234,50`). */
export function formatDecimal(valor: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor ?? 0))
}
