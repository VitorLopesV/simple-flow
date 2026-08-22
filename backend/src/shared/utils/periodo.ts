import type { Periodo } from '../types/common'

/** Converte um período `{ mes, ano }` para o formato de competência `YYYY-MM` usado no banco. */
export function paraCompetencia(periodo: Periodo): string {
  return `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}`
}

/** Converte uma competência `YYYY-MM` de volta para `{ mes, ano }`. */
export function paraPeriodo(competencia: string): Periodo {
  const [ano, mes] = competencia.split('-').map(Number)
  return { mes, ano }
}

/** Primeiro e último dia (ISO `YYYY-MM-DD`) do mês de competência informado. */
export function limitesDoMes(periodo: Periodo): { inicio: string; fim: string } {
  const inicio = new Date(Date.UTC(periodo.ano, periodo.mes - 1, 1))
  const fim = new Date(Date.UTC(periodo.ano, periodo.mes, 0))
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) }
}
