import type { Categoria } from '@/types/categoria'
import { http, USE_MOCK } from './http'
import { delay, mockDb } from './mock'

/**
 * Alfabética, mas o catch-all "Outros" sempre por último — não faz sentido
 * misturado por ordem alfabética. A API real já devolve ordenado por nome
 * (`SupabaseCategoriaRepository.listar`), então reordenamos aqui no cliente em
 * vez de duplicar essa regra no backend.
 */
function ehCatchAll(categoria: Categoria): boolean {
  return categoria.tipo === 'OUTROS' || /^outr/i.test(categoria.nome)
}

function compararCategorias(a: Categoria, b: Categoria): number {
  if (ehCatchAll(a) && !ehCatchAll(b)) return 1
  if (ehCatchAll(b) && !ehCatchAll(a)) return -1
  return a.nome.localeCompare(b.nome, 'pt-BR')
}

export const categoriaService = {
  async listar(): Promise<Categoria[]> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(db.clonar(db.categorias).sort(compararCategorias))
    }

    const { data } = await http.get<Categoria[]>('/categorias')
    return [...data].sort(compararCategorias)
  },
}
