/**
 * Helpers de data.
 *
 * Convenção: datas trafegam e são persistidas como `YYYY-MM-DD` (sem fuso).
 * Toda conversão para `Date` usa horário local ao meio-dia para evitar o
 * clássico off-by-one causado por UTC em fusos negativos como o do Brasil.
 */
import type { Periodo } from '@/types/common'

export const MESES = [
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

export const MESES_CURTOS = [
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
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1, 12, 0, 0)
}

/** `Date` -> `'2026-08-15'`. */
export function toISODate(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** `'2026-08-15'` -> `'15/08/2026'`. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return toDate(iso).toLocaleDateString('pt-BR')
}

/** `'2026-08-15'` -> `'15/08/2026'`, vazio se não houver valor. Usado no texto editável do DateInput. */
export function paraMascaraDataBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return ''
  return `${dia}/${mes}/${ano}`
}

/** Reaplica a máscara dd/mm/aaaa a cada tecla digitada, ignorando o que não for dígito. */
export function mascararDataBR(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '').slice(0, 8)
  const dia = digitos.slice(0, 2)
  const mes = digitos.slice(2, 4)
  const ano = digitos.slice(4, 8)
  return [dia, mes, ano].filter(Boolean).join('/')
}

/** `'15/08/2026'` -> `'2026-08-15'`, ou `null` se a máscara ainda estiver incompleta/inválida. */
export function paraISODataBR(mascarada: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mascarada)
  if (!match) return null
  const [, dia, mes, ano] = match
  return `${ano}-${mes}-${dia}`
}

/** `'2026-08-15'` -> `'15 de ago.'`. */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const data = toDate(iso)
  return `${data.getDate()} de ${MESES_CURTOS[data.getMonth()]?.toLowerCase()}.`
}

/** `{ mes: 8, ano: 2026 }` -> `'Agosto de 2026'`. */
export function formatPeriodo(periodo: Periodo): string {
  return `${MESES[periodo.mes - 1]} de ${periodo.ano}`
}

/** `{ mes: 8, ano: 2026 }` -> `'2026-08'`. */
export function toCompetencia(periodo: Periodo): string {
  return `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}`
}

/** `'2026-08'` -> `{ mes: 8, ano: 2026 }`. */
export function fromCompetencia(competencia: string): Periodo {
  const [ano, mes] = competencia.split('-').map(Number)
  return { mes: mes ?? 1, ano: ano ?? new Date().getFullYear() }
}

export function periodoAtual(): Periodo {
  const hoje = new Date()
  return { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() }
}

/** Soma (ou subtrai, com valor negativo) meses a um período. */
export function addMeses(periodo: Periodo, quantidade: number): Periodo {
  const total = periodo.ano * 12 + (periodo.mes - 1) + quantidade
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 }
}

export function mesmoPeriodo(a: Periodo, b: Periodo): boolean {
  return a.mes === b.mes && a.ano === b.ano
}

/** Verdadeiro se a data ISO cai dentro do período informado. */
export function dentroDoPeriodo(iso: string, periodo: Periodo): boolean {
  const data = toDate(iso)
  return data.getMonth() + 1 === periodo.mes && data.getFullYear() === periodo.ano
}

/** Último dia do mês do período (28-31). */
export function ultimoDiaDoMes(periodo: Periodo): number {
  return new Date(periodo.ano, periodo.mes, 0).getDate()
}

/** Data ISO de um dia dentro do período, limitada ao último dia do mês. */
export function diaDoPeriodo(periodo: Periodo, dia: number): string {
  const seguro = Math.min(dia, ultimoDiaDoMes(periodo))
  return `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}-${String(seguro).padStart(2, '0')}`
}

/** Os `n` períodos que terminam em `periodo` (inclusive), do mais antigo ao mais recente. */
export function ultimosPeriodos(periodo: Periodo, n: number): Periodo[] {
  return Array.from({ length: n }, (_, i) => addMeses(periodo, i - (n - 1)))
}

/** Rótulo curto para eixos de gráfico: `'ago/26'`. */
export function labelCurtoPeriodo(periodo: Periodo): string {
  return `${MESES_CURTOS[periodo.mes - 1]?.toLowerCase()}/${String(periodo.ano).slice(-2)}`
}

/** Dias até o vencimento (negativo se já venceu). */
export function diasAte(iso: string): number {
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  const diff = toDate(iso).getTime() - hoje.getTime()
  return Math.round(diff / 86_400_000)
}
