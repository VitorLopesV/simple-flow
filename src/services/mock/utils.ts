import type { PageRequest, Paginated } from '@/types/common'
import { MOCK_LATENCY } from '../http'

/** Simula a latência da rede para que loadings e skeletons sejam exercitados. */
export function delay<T>(value: T, ms = MOCK_LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function paginate<T>(items: T[], { page, pageSize }: PageRequest): Paginated<T> {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  }
}

/** Busca acento-insensível e case-insensível. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function matchesSearch(text: string, search: string | undefined | null): boolean {
  if (!search?.trim()) return true
  return normalize(text).includes(normalize(search))
}
