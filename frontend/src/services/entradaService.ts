import type { Paginated, Periodo } from '@/types/common'
import type { Entrada, EntradaFiltro, EntradaPayload, EntradaResumo } from '@/types/entrada'
import { addMeses, dentroDoPeriodo, toCompetencia } from '@/utils/dateFormatter'
import { http, USE_MOCK } from './http'
import { contemBusca, delay, mockDb, paginar } from './mock'

export const entradaService = {
  async listar(filtro: EntradaFiltro): Promise<Paginated<Entrada>> {
    if (USE_MOCK) {
      const db = await mockDb()
      const encontradas = db
        .comRecorrencias(db.entradas, filtro.periodo)
        .filter((entrada) => dentroDoPeriodo(entrada.data, filtro.periodo))
        .filter((entrada) => !filtro.categoriaId || entrada.categoriaId === filtro.categoriaId)
        .filter((entrada) =>
          contemBusca(`${entrada.descricao} ${entrada.observacao ?? ''}`, filtro.busca),
        )
        .sort((a, b) => b.data.localeCompare(a.data))

      return delay(paginar(db.clonar(encontradas), filtro))
    }

    const { data } = await http.get<Paginated<Entrada>>('/entradas', {
      params: {
        mes: filtro.periodo.mes,
        ano: filtro.periodo.ano,
        categoriaId: filtro.categoriaId ?? undefined,
        busca: filtro.busca || undefined,
        page: filtro.page,
        pageSize: filtro.pageSize,
      },
    })
    return data
  },

  async resumo(periodo: Periodo): Promise<EntradaResumo> {
    if (USE_MOCK) {
      const db = await mockDb()

      const totalDoPeriodo = (alvo: Periodo) =>
        db
          .comRecorrencias(db.entradas, alvo)
          .filter((entrada) => dentroDoPeriodo(entrada.data, alvo))
          .reduce((soma, entrada) => soma + entrada.valor, 0)

      const doPeriodo = db
        .comRecorrencias(db.entradas, periodo)
        .filter((entrada) => dentroDoPeriodo(entrada.data, periodo))
      const total = doPeriodo.reduce((soma, entrada) => soma + entrada.valor, 0)

      const agrupado = new Map<string, number>()
      for (const entrada of doPeriodo) {
        agrupado.set(entrada.categoriaId, (agrupado.get(entrada.categoriaId) ?? 0) + entrada.valor)
      }

      const porCategoria = [...agrupado.entries()]
        .map(([categoriaId, valor]) => {
          const categoria = db.categorias.find((item) => item.id === categoriaId)
          return {
            categoriaId,
            nome: categoria?.nome ?? 'Sem categoria',
            cor: categoria?.cor ?? '#94a3b8',
            total: valor,
          }
        })
        .sort((a, b) => b.total - a.total)

      return delay({
        total,
        quantidade: doPeriodo.length,
        media: doPeriodo.length ? total / doPeriodo.length : 0,
        totalMesAnterior: totalDoPeriodo(addMeses(periodo, -1)),
        porCategoria,
      })
    }

    const { data } = await http.get<EntradaResumo>('/entradas/resumo', {
      params: { competencia: toCompetencia(periodo) },
    })
    return data
  },

  async criar(payload: EntradaPayload): Promise<Entrada> {
    if (USE_MOCK) {
      const db = await mockDb()
      const entrada: Entrada = {
        ...payload,
        id: db.novoId('ent'),
        criadoEm: db.agora(),
        atualizadoEm: db.agora(),
      }
      db.entradas.push(entrada)
      return delay(db.clonar(entrada))
    }

    const { data } = await http.post<Entrada>('/entradas', payload)
    return data
  },

  async atualizar(id: string, payload: EntradaPayload): Promise<Entrada> {
    if (USE_MOCK) {
      const db = await mockDb()
      const indice = db.entradas.findIndex((entrada) => entrada.id === id)
      if (indice < 0) throw new Error('Entrada não encontrada.')

      const atualizada: Entrada = { ...db.entradas[indice]!, ...payload, atualizadoEm: db.agora() }
      db.entradas[indice] = atualizada
      return delay(db.clonar(atualizada))
    }

    const { data } = await http.put<Entrada>(`/entradas/${id}`, payload)
    return data
  },

  async remover(id: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const indice = db.entradas.findIndex((entrada) => entrada.id === id)
      if (indice < 0) throw new Error('Entrada não encontrada.')
      db.entradas.splice(indice, 1)
      return delay(undefined)
    }

    await http.delete(`/entradas/${id}`)
  },
}
