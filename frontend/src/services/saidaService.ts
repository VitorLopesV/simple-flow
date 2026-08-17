import type { Paginated, Periodo } from '@/types/common'
import type { Saida, SaidaFiltro, SaidaPayload, SaidaResumo } from '@/types/saida'
import { addMeses, dentroDoPeriodo, toCompetencia } from '@/utils/dateFormatter'
import { http, USE_MOCK } from './http'
import { contemBusca, delay, mockDb, paginar } from './mock'

export const saidaService = {
  async listar(filtro: SaidaFiltro): Promise<Paginated<Saida>> {
    if (USE_MOCK) {
      const db = await mockDb()
      const encontradas = db.saidasComFaturas()
        .filter((saida) => dentroDoPeriodo(saida.data, filtro.periodo))
        .filter((saida) => !filtro.categoriaId || saida.categoriaId === filtro.categoriaId)
        .filter((saida) => !filtro.status || saida.status === filtro.status)
        .filter((saida) => contemBusca(`${saida.descricao} ${saida.observacao ?? ''}`, filtro.busca))
        .sort((a, b) => b.data.localeCompare(a.data))

      return delay(paginar(db.clonar(encontradas), filtro))
    }

    const { data } = await http.get<Paginated<Saida>>('/saidas', {
      params: {
        mes: filtro.periodo.mes,
        ano: filtro.periodo.ano,
        categoriaId: filtro.categoriaId ?? undefined,
        status: filtro.status ?? undefined,
        busca: filtro.busca || undefined,
        page: filtro.page,
        pageSize: filtro.pageSize,
      },
    })
    return data
  },

  async resumo(periodo: Periodo): Promise<SaidaResumo> {
    if (USE_MOCK) {
      const db = await mockDb()
      const todas = db.saidasComFaturas()

      const totalDoPeriodo = (alvo: Periodo) =>
        todas
          .filter((saida) => dentroDoPeriodo(saida.data, alvo))
          .reduce((soma, saida) => soma + saida.valor, 0)

      const doPeriodo = todas.filter((saida) => dentroDoPeriodo(saida.data, periodo))
      const total = doPeriodo.reduce((soma, saida) => soma + saida.valor, 0)

      const agrupado = new Map<string, number>()
      for (const saida of doPeriodo) {
        agrupado.set(saida.categoriaId, (agrupado.get(saida.categoriaId) ?? 0) + saida.valor)
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
        totalPago: doPeriodo
          .filter((saida) => saida.status === 'PAGO')
          .reduce((soma, saida) => soma + saida.valor, 0),
        totalPendente: doPeriodo
          .filter((saida) => saida.status === 'PENDENTE')
          .reduce((soma, saida) => soma + saida.valor, 0),
        totalMesAnterior: totalDoPeriodo(addMeses(periodo, -1)),
        porCategoria,
      })
    }

    const { data } = await http.get<SaidaResumo>('/saidas/resumo', {
      params: { competencia: toCompetencia(periodo) },
    })
    return data
  },

  async criar(payload: SaidaPayload): Promise<Saida> {
    if (USE_MOCK) {
      const db = await mockDb()
      const saida: Saida = {
        ...payload,
        id: db.novoId('sai'),
        criadoEm: db.agora(),
        atualizadoEm: db.agora(),
      }
      db.saidas.push(saida)
      return delay(db.clonar(saida))
    }

    const { data } = await http.post<Saida>('/saidas', payload)
    return data
  },

  async atualizar(id: string, payload: SaidaPayload): Promise<Saida> {
    if (USE_MOCK) {
      const db = await mockDb()
      const indice = db.saidas.findIndex((saida) => saida.id === id)
      if (indice < 0) throw new Error('Saída não encontrada.')

      const atualizada: Saida = { ...db.saidas[indice]!, ...payload, atualizadoEm: db.agora() }
      db.saidas[indice] = atualizada
      return delay(db.clonar(atualizada))
    }

    const { data } = await http.put<Saida>(`/saidas/${id}`, payload)
    return data
  },

  async remover(id: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const indice = db.saidas.findIndex((saida) => saida.id === id)
      if (indice < 0) throw new Error('Saída não encontrada.')
      db.saidas.splice(indice, 1)
      return delay(undefined)
    }

    await http.delete(`/saidas/${id}`)
  },
}
