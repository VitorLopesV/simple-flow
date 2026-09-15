import type { Categoria } from '@/types/categoria'
import { http, USE_MOCK } from './http'
import { delay, mockDb } from './mock'

/** Alfabética, mas "Outros" sempre por último — é o catch-all, não faz sentido misturado. */
function compararCategorias(a: Categoria, b: Categoria): number {
  if (a.tipo === 'OUTROS' && b.tipo !== 'OUTROS') return 1
  if (b.tipo === 'OUTROS' && a.tipo !== 'OUTROS') return -1
  return a.nome.localeCompare(b.nome, 'pt-BR')
}

export const categoriaService = {
  async listar(): Promise<Categoria[]> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(db.clonar(db.categorias).sort(compararCategorias))
    }

    const { data } = await http.get<Categoria[]>('/categorias')
    return data
  },
}
