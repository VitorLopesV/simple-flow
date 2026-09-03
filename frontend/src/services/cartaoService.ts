import type {
  Cartao,
  CartaoComFatura,
  CartaoPayload,
  FaturaDetalhada,
  FaturaFiltro,
  TransacaoCartao,
  TransacaoCartaoPayload,
} from '@/types/cartao'
import { toCompetencia } from '@/utils/dateFormatter'
import { http, USE_MOCK } from './http'
import { delay, mockDb } from './mock'

export const cartaoService = {
  async listar(): Promise<Cartao[]> {
    if (USE_MOCK) {
      const db = await mockDb()
      return delay(
        db
          .clonar(db.cartoes)
          .sort(
            (a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'),
          ),
      )
    }

    const { data } = await http.get<Cartao[]>('/cartoes')
    return data
  },

  /** Cartões já combinados com a fatura da competência escolhida. */
  async listarComFaturas(filtro: FaturaFiltro): Promise<CartaoComFatura[]> {
    const competencia = toCompetencia(filtro.periodo)

    if (USE_MOCK) {
      const db = await mockDb()

      const montarFatura = (cartaoId: string): FaturaDetalhada | null => {
        const fatura = db.faturas.find(
          (item) => item.cartaoId === cartaoId && item.competencia === competencia,
        )
        if (!fatura) return null

        return {
          ...fatura,
          transacoes: db.transacoesCartao
            .filter((transacao) => transacao.faturaId === fatura.id)
            .sort((a, b) => b.data.localeCompare(a.data)),
        }
      }

      const alvo = filtro.cartaoId
        ? db.cartoes.filter((cartao) => cartao.id === filtro.cartaoId)
        : db.cartoes

      const resultado: CartaoComFatura[] = alvo
        .slice()
        .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((cartao) => {
          const fatura = montarFatura(cartao.id)
          return {
            cartao: db.clonar(cartao),
            fatura: fatura ? db.clonar(fatura) : null,
            usoLimite: fatura && cartao.limite > 0 ? (fatura.total / cartao.limite) * 100 : 0,
          }
        })

      return delay(resultado)
    }

    const { data } = await http.get<CartaoComFatura[]>('/cartoes/faturas', {
      params: { competencia, cartaoId: filtro.cartaoId ?? undefined },
    })
    return data
  },

  async criar(payload: CartaoPayload): Promise<Cartao> {
    if (USE_MOCK) {
      const db = await mockDb()
      const cartao: Cartao = { ...payload, id: db.novoId('car'), criadoEm: db.agora() }
      db.cartoes.push(cartao)
      return delay(db.clonar(cartao))
    }

    const { data } = await http.post<Cartao>('/cartoes', payload)
    return data
  },

  async atualizar(id: string, payload: CartaoPayload): Promise<Cartao> {
    if (USE_MOCK) {
      const db = await mockDb()
      const indice = db.cartoes.findIndex((cartao) => cartao.id === id)
      if (indice < 0) throw new Error('Cartão não encontrado.')

      const atualizado: Cartao = { ...db.cartoes[indice]!, ...payload }
      db.cartoes[indice] = atualizado
      return delay(db.clonar(atualizado))
    }

    const { data } = await http.put<Cartao>(`/cartoes/${id}`, payload)
    return data
  },

  async remover(id: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const indice = db.cartoes.findIndex((cartao) => cartao.id === id)
      if (indice < 0) throw new Error('Cartão não encontrado.')
      db.cartoes.splice(indice, 1)

      // Remove faturas e transações órfãs do cartão excluído.
      const faturasDoCartao = db.faturas
        .filter((fatura) => fatura.cartaoId === id)
        .map((fatura) => fatura.id)

      for (let i = db.transacoesCartao.length - 1; i >= 0; i -= 1) {
        if (faturasDoCartao.includes(db.transacoesCartao[i]!.faturaId)) {
          db.transacoesCartao.splice(i, 1)
        }
      }
      for (let i = db.faturas.length - 1; i >= 0; i -= 1) {
        if (db.faturas[i]!.cartaoId === id) db.faturas.splice(i, 1)
      }

      return delay(undefined)
    }

    await http.delete(`/cartoes/${id}`)
  },

  /**
   * Débito lançado direto no cartão — a fatura da competência da data é criada
   * como ABERTA se ainda não existir e passa a somar o débito.
   */
  async criarTransacao(cartaoId: string, payload: TransacaoCartaoPayload): Promise<TransacaoCartao> {
    if (USE_MOCK) {
      const db = await mockDb()
      const fatura = db.garantirFatura(cartaoId, payload.data.slice(0, 7))

      const transacao: TransacaoCartao = {
        ...payload,
        id: db.novoId('trc'),
        cartaoId,
        faturaId: fatura.id,
        criadoEm: db.agora(),
        atualizadoEm: db.agora(),
      }
      db.transacoesCartao.push(transacao)
      db.recalcularTotalFatura(fatura.id)

      return delay(db.clonar(transacao))
    }

    const { data } = await http.post<TransacaoCartao>(`/cartoes/${cartaoId}/transacoes`, payload)
    return data
  },

  /** Mudar a data pode mover o débito para a fatura de outra competência. */
  async atualizarTransacao(
    cartaoId: string,
    id: string,
    payload: TransacaoCartaoPayload,
  ): Promise<TransacaoCartao> {
    if (USE_MOCK) {
      const db = await mockDb()
      const indice = db.transacoesCartao.findIndex((transacao) => transacao.id === id)
      if (indice < 0) throw new Error('Transação não encontrada.')

      const anterior = db.transacoesCartao[indice]!
      const fatura = db.garantirFatura(cartaoId, payload.data.slice(0, 7))

      const atualizada: TransacaoCartao = {
        ...anterior,
        ...payload,
        faturaId: fatura.id,
        atualizadoEm: db.agora(),
      }
      db.transacoesCartao[indice] = atualizada

      db.recalcularTotalFatura(anterior.faturaId)
      if (fatura.id !== anterior.faturaId) db.recalcularTotalFatura(fatura.id)

      return delay(db.clonar(atualizada))
    }

    const { data } = await http.put<TransacaoCartao>(`/cartoes/${cartaoId}/transacoes/${id}`, payload)
    return data
  },

  async removerTransacao(cartaoId: string, id: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const indice = db.transacoesCartao.findIndex((transacao) => transacao.id === id)
      if (indice < 0) throw new Error('Transação não encontrada.')

      const [removida] = db.transacoesCartao.splice(indice, 1)
      db.recalcularTotalFatura(removida!.faturaId)

      return delay(undefined)
    }

    await http.delete(`/cartoes/${cartaoId}/transacoes/${id}`)
  },

  async pagarFatura(faturaId: string): Promise<void> {
    if (USE_MOCK) {
      const db = await mockDb()
      const fatura = db.faturas.find((item) => item.id === faturaId)
      if (!fatura) throw new Error('Fatura não encontrada.')

      fatura.status = 'PAGA'
      fatura.pagoEm = new Date().toISOString().slice(0, 10)
      return delay(undefined)
    }

    await http.patch(`/faturas/${faturaId}/pagar`)
  },
}
