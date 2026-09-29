import type { Category } from '@/types/category'
import type { CategoryDto } from '@/types/dto'
import { http, USE_MOCK } from './http'
import { toCategory } from './mappers'
import { delay, mockDb } from './mock'

/**
 * Alfabética, mas o catch-all "Outros" sempre por último — não faz sentido
 * misturado por ordem alfabética. A API real já devolve ordenado por nome
 * (`SupabaseCategoriaRepository.listar`), então reordenamos aqui no cliente em
 * vez de duplicar essa regra no backend.
 */
function isCatchAll(category: Category): boolean {
  return category.type === 'OUTROS' || /^outr/i.test(category.name)
}

function compareCategories(a: Category, b: Category): number {
  if (isCatchAll(a) && !isCatchAll(b)) return 1
  if (isCatchAll(b) && !isCatchAll(a)) return -1
  return a.name.localeCompare(b.name, 'pt-BR')
}

export const categoryService = {
  async list(): Promise<Category[]> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(db.clone(db.categories).sort(compareCategories))
    }

    const { data } = await http.get<CategoryDto[]>('/categorias')
    return data.map(toCategory).sort(compareCategories)
  },
}
