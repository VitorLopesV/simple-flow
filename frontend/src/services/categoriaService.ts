import type { Categoria } from '@/types/categoria'
import { http, USE_MOCK } from './http'
import { delay, mockDb } from './mock'

export const categoriaService = {
  async listar(): Promise<Categoria[]> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(db.clonar(db.categorias).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
    }

    const { data } = await http.get<Categoria[]>('/categorias')
    return data
  },
}
