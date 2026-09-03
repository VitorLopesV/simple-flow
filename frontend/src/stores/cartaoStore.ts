import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { cartaoService } from '@/services/cartaoService'
import { mensagemDeErro } from '@/services/http'
import type {
  Cartao,
  CartaoComFatura,
  CartaoPayload,
  TransacaoCartaoPayload,
} from '@/types/cartao'
import { addMeses, diaDoPeriodo, fromCompetencia, toDate } from '@/utils/dateFormatter'
import { usePeriodoStore } from './periodoStore'

/** Divide um valor em `n` parcelas (centavos inteiros), sobrando o resto para as primeiras. */
function dividirEmParcelas(valor: number, n: number): number[] {
  const totalCentavos = Math.round(valor * 100)
  const base = Math.floor(totalCentavos / n)
  const resto = totalCentavos - base * n
  return Array.from({ length: n }, (_, i) => (base + (i < resto ? 1 : 0)) / 100)
}

export const useCartaoStore = defineStore('cartao', () => {
  const periodoStore = usePeriodoStore()

  const cartoes = ref<CartaoComFatura[]>([])
  const cartaoSelecionadoId = ref<string | null>(null)

  const loading = ref(false)
  const salvando = ref(false)
  const erro = ref<string | null>(null)

  const selecionado = computed<CartaoComFatura | null>(() => {
    if (!cartoes.value.length) return null
    return (
      cartoes.value.find((item) => item.cartao.id === cartaoSelecionadoId.value) ??
      cartoes.value[0] ??
      null
    )
  })

  const totalFaturas = computed(() =>
    cartoes.value.reduce((soma, item) => soma + (item.fatura?.total ?? 0), 0),
  )

  const limiteTotal = computed(() =>
    cartoes.value.filter((item) => item.cartao.ativo).reduce((soma, item) => soma + item.cartao.limite, 0),
  )

  const faturasEmAberto = computed(
    () => cartoes.value.filter((item) => item.fatura && item.fatura.status !== 'PAGA').length,
  )

  const vazio = computed(() => !loading.value && cartoes.value.length === 0)

  async function carregar(): Promise<void> {
    loading.value = true
    erro.value = null
    try {
      cartoes.value = await cartaoService.listarComFaturas({ periodo: periodoStore.periodo })

      const aindaExiste = cartoes.value.some((item) => item.cartao.id === cartaoSelecionadoId.value)
      if (!aindaExiste) cartaoSelecionadoId.value = cartoes.value[0]?.cartao.id ?? null
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível carregar os cartões.')
      cartoes.value = []
    } finally {
      loading.value = false
    }
  }

  function selecionar(id: string): void {
    cartaoSelecionadoId.value = id
  }

  async function criar(payload: CartaoPayload): Promise<boolean> {
    salvando.value = true
    try {
      const cartao = await cartaoService.criar(payload)
      await carregar()
      cartaoSelecionadoId.value = cartao.id
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível salvar o cartão.')
      return false
    } finally {
      salvando.value = false
    }
  }

  async function atualizar(id: string, payload: CartaoPayload): Promise<boolean> {
    salvando.value = true
    try {
      await cartaoService.atualizar(id, payload)
      await carregar()
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível atualizar o cartão.')
      return false
    } finally {
      salvando.value = false
    }
  }

  async function remover(id: string): Promise<boolean> {
    salvando.value = true
    try {
      await cartaoService.remover(id)
      await carregar()
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível excluir o cartão.')
      return false
    } finally {
      salvando.value = false
    }
  }

  async function criarTransacao(cartaoId: string, payload: TransacaoCartaoPayload): Promise<boolean> {
    salvando.value = true
    try {
      const totalParcelas = payload.totalParcelas

      if (totalParcelas <= 1) {
        await cartaoService.criarTransacao(cartaoId, payload)
      } else {
        // Compra parcelada: uma transação por competência futura, valor dividido
        // (resto fica com as primeiras parcelas), mesmo dia do mês da compra.
        const valores = dividirEmParcelas(payload.valor, totalParcelas)
        const dia = toDate(payload.data).getDate()
        const competenciaBase = fromCompetencia(payload.data.slice(0, 7))

        for (let i = 0; i < totalParcelas; i += 1) {
          await cartaoService.criarTransacao(cartaoId, {
            ...payload,
            valor: valores[i]!,
            data: diaDoPeriodo(addMeses(competenciaBase, i), dia),
            parcelaAtual: i + 1,
            totalParcelas,
          })
        }
      }

      await carregar()
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível salvar o débito.')
      return false
    } finally {
      salvando.value = false
    }
  }

  async function atualizarTransacao(
    cartaoId: string,
    id: string,
    payload: TransacaoCartaoPayload,
  ): Promise<boolean> {
    salvando.value = true
    try {
      await cartaoService.atualizarTransacao(cartaoId, id, payload)
      await carregar()
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível atualizar o débito.')
      return false
    } finally {
      salvando.value = false
    }
  }

  async function removerTransacao(cartaoId: string, id: string): Promise<boolean> {
    salvando.value = true
    try {
      await cartaoService.removerTransacao(cartaoId, id)
      await carregar()
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível excluir o débito.')
      return false
    } finally {
      salvando.value = false
    }
  }

  async function pagarFatura(faturaId: string): Promise<boolean> {
    salvando.value = true
    try {
      await cartaoService.pagarFatura(faturaId)
      await carregar()
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível registrar o pagamento.')
      return false
    } finally {
      salvando.value = false
    }
  }

  /** Lista simples (sem fatura), útil para selects de forma de pagamento. */
  const opcoesDeCartao = computed(() =>
    cartoes.value
      .filter((item) => item.cartao.ativo)
      .map((item) => ({
        label: `${item.cartao.nome} ····${item.cartao.ultimosDigitos}`,
        value: item.cartao.id,
      })),
  )

  function porId(id: string | null | undefined): Cartao | null {
    if (!id) return null
    return cartoes.value.find((item) => item.cartao.id === id)?.cartao ?? null
  }

  return {
    cartoes,
    cartaoSelecionadoId,
    loading,
    salvando,
    erro,
    selecionado,
    totalFaturas,
    limiteTotal,
    faturasEmAberto,
    vazio,
    opcoesDeCartao,
    carregar,
    selecionar,
    criar,
    atualizar,
    remover,
    criarTransacao,
    atualizarTransacao,
    removerTransacao,
    pagarFatura,
    porId,
  }
})
