import type { PageRequest, Paginated } from '@/types/common'
import { MOCK_LATENCY } from '../http'

/** Simula a latência da rede para que loadings e skeletons sejam exercitados. */
export function delay<T>(valor: T, ms = MOCK_LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ms))
}

export function paginar<T>(itens: T[], { page, pageSize }: PageRequest): Paginated<T> {
  const total = itens.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const paginaSegura = Math.min(Math.max(1, page), totalPages)
  const inicio = (paginaSegura - 1) * pageSize

  return {
    items: itens.slice(inicio, inicio + pageSize),
    page: paginaSegura,
    pageSize,
    total,
    totalPages,
  }
}

/** Busca acento-insensível e case-insensível. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function contemBusca(texto: string, busca: string | undefined | null): boolean {
  if (!busca?.trim()) return true
  return normalizar(texto).includes(normalizar(busca))
}
