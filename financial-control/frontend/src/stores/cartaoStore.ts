import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { cartaoService } from '@/services/cartaoService'
import { mensagemDeErro } from '@/services/http'
import type { Cartao, CartaoComFatura, CartaoPayload } from '@/types/cartao'
import { usePeriodoStore } from './periodoStore'

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
    pagarFatura,
    porId,
  }
})
