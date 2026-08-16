import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { entradaService } from '@/services/entradaService'
import { mensagemDeErro } from '@/services/http'
import type { Entrada, EntradaPayload, EntradaResumo } from '@/types/entrada'
import { calcularVariacao } from '@/utils/currencyFormatter'
import { usePeriodoStore } from './periodoStore'

const PAGE_SIZE_PADRAO = 8

export const useEntradaStore = defineStore('entrada', () => {
  const periodoStore = usePeriodoStore()

  const itens = ref<Entrada[]>([])
  const resumo = ref<EntradaResumo | null>(null)

  const loading = ref(false)
  const salvando = ref(false)
  const erro = ref<string | null>(null)

  const page = ref(1)
  const pageSize = ref(PAGE_SIZE_PADRAO)
  const total = ref(0)
  const totalPages = ref(1)

  const categoriaId = ref<string | null>(null)
  const busca = ref('')

  const totalPeriodo = computed(() => resumo.value?.total ?? 0)
  const variacao = computed(() =>
    resumo.value ? calcularVariacao(resumo.value.total, resumo.value.totalMesAnterior) : 0,
  )
  const temFiltroAtivo = computed(() => Boolean(categoriaId.value) || busca.value.trim() !== '')
  const vazio = computed(() => !loading.value && itens.value.length === 0)

  async function carregar(): Promise<void> {
    loading.value = true
    erro.value = null
    try {
      const filtro = {
        periodo: periodoStore.periodo,
        categoriaId: categoriaId.value,
        busca: busca.value,
        page: page.value,
        pageSize: pageSize.value,
      }

      const [pagina, novoResumo] = await Promise.all([
        entradaService.listar(filtro),
        entradaService.resumo(periodoStore.periodo),
      ])

      itens.value = pagina.items
      page.value = pagina.page
      total.value = pagina.total
      totalPages.value = pagina.totalPages
      resumo.value = novoResumo
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível carregar as entradas.')
      itens.value = []
    } finally {
      loading.value = false
    }
  }

  async function criar(payload: EntradaPayload): Promise<boolean> {
    salvando.value = true
    try {
      await entradaService.criar(payload)
      page.value = 1
      await carregar()
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível salvar a entrada.')
      return false
    } finally {
      salvando.value = false
    }
  }

  async function atualizar(id: string, payload: EntradaPayload): Promise<boolean> {
    salvando.value = true
    try {
      await entradaService.atualizar(id, payload)
      await carregar()
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível atualizar a entrada.')
      return false
    } finally {
      salvando.value = false
    }
  }

  async function remover(id: string): Promise<boolean> {
    salvando.value = true
    try {
      await entradaService.remover(id)
      // Se a página ficou vazia após a remoção, volta uma página.
      if (itens.value.length === 1 && page.value > 1) page.value -= 1
      await carregar()
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível excluir a entrada.')
      return false
    } finally {
      salvando.value = false
    }
  }

  function irParaPagina(novaPagina: number): void {
    page.value = Math.min(Math.max(1, novaPagina), totalPages.value)
    void carregar()
  }

  function filtrarPorCategoria(id: string | null): void {
    categoriaId.value = id
    page.value = 1
    void carregar()
  }

  function buscar(texto: string): void {
    busca.value = texto
    page.value = 1
    void carregar()
  }

  function limparFiltros(): void {
    categoriaId.value = null
    busca.value = ''
    page.value = 1
    void carregar()
  }

  return {
    itens,
    resumo,
    loading,
    salvando,
    erro,
    page,
    pageSize,
    total,
    totalPages,
    categoriaId,
    busca,
    totalPeriodo,
    variacao,
    temFiltroAtivo,
    vazio,
    carregar,
    criar,
    atualizar,
    remover,
    irParaPagina,
    filtrarPorCategoria,
    buscar,
    limparFiltros,
  }
})
