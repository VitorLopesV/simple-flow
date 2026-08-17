import type { Periodo, SeriePonto } from '@/types/common'
import type { DashboardResumo, TransacaoRecente } from '@/types/dashboard'
import { calcularVariacao } from '@/utils/currencyFormatter'
import {
  dentroDoPeriodo,
  labelCurtoPeriodo,
  toCompetencia,
  ultimosPeriodos,
} from '@/utils/dateFormatter'
import { http, USE_MOCK } from './http'
import { delay, mockDb } from './mock'

const MESES_NO_GRAFICO = 6

function somar(valores: { valor: number }[]): number {
  return valores.reduce((soma, item) => soma + item.valor, 0)
}

function serie(registros: { data: string; valor: number }[], periodo: Periodo): SeriePonto[] {
  return ultimosPeriodos(periodo, MESES_NO_GRAFICO).map((mes) => ({
    label: labelCurtoPeriodo(mes),
    valor: somar(registros.filter((registro) => dentroDoPeriodo(registro.data, mes))),
  }))
}

export const dashboardService = {
  async resumo(periodo: Periodo): Promise<DashboardResumo> {
    if (USE_MOCK) {
      const db = await mockDb()

      const todasSaidas = db.saidasComFaturas()
      const entradasDoMes = db.entradas.filter((entrada) => dentroDoPeriodo(entrada.data, periodo))
      const saidasDoMes = todasSaidas.filter((saida) => dentroDoPeriodo(saida.data, periodo))

      const totalEntradas = somar(entradasDoMes)
      const totalSaidas = somar(saidasDoMes)

      const serieEntradas = serie(db.entradas, periodo)
      const serieSaidas = serie(todasSaidas, periodo)

      const competencia = toCompetencia(periodo)
      const totalFaturas = db.faturas
        .filter((fatura) => fatura.competencia === competencia && fatura.status !== 'PAGA')
        .reduce((soma, fatura) => soma + fatura.total, 0)

      const agrupado = new Map<string, number>()
      for (const saida of saidasDoMes) {
        agrupado.set(saida.categoriaId, (agrupado.get(saida.categoriaId) ?? 0) + saida.valor)
      }

      const categoria = (id: string) => db.categorias.find((item) => item.id === id)

      const gastosPorCategoria = [...agrupado.entries()]
        .map(([categoriaId, total]) => ({
          nome: categoria(categoriaId)?.nome ?? 'Outros',
          cor: categoria(categoriaId)?.cor ?? '#94a3b8',
          total,
        }))
        .sort((a, b) => b.total - a.total)

      const transacoesRecentes: TransacaoRecente[] = [
        ...entradasDoMes.map<TransacaoRecente>((entrada) => ({
          id: entrada.id,
          tipo: 'ENTRADA',
          descricao: entrada.descricao,
          valor: entrada.valor,
          data: entrada.data,
          categoriaNome: categoria(entrada.categoriaId)?.nome ?? 'Sem categoria',
          categoriaCor: categoria(entrada.categoriaId)?.cor ?? '#94a3b8',
        })),
        ...saidasDoMes.map<TransacaoRecente>((saida) => ({
          id: saida.id,
          tipo: 'SAIDA',
          descricao: saida.descricao,
          valor: saida.valor,
          data: saida.data,
          categoriaNome: categoria(saida.categoriaId)?.nome ?? 'Sem categoria',
          categoriaCor: categoria(saida.categoriaId)?.cor ?? '#94a3b8',
        })),
      ]
        .sort((a, b) => b.data.localeCompare(a.data))
        .slice(0, 8)

      return delay({
        totalEntradas,
        totalSaidas,
        saldo: totalEntradas - totalSaidas,
        totalFaturas,
        variacaoEntradas: calcularVariacao(totalEntradas, serieEntradas.at(-2)?.valor ?? 0),
        variacaoSaidas: calcularVariacao(totalSaidas, serieSaidas.at(-2)?.valor ?? 0),
        serieEntradas,
        serieSaidas,
        gastosPorCategoria,
        transacoesRecentes,
      })
    }

    const { data } = await http.get<DashboardResumo>('/dashboard/resumo', {
      params: { competencia: toCompetencia(periodo) },
    })
    return data
  },
}
