import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { categoriaService } from '@/services/categoriaService'
import { mensagemDeErro } from '@/services/http'
import type { OpcaoSelect } from '@/types/common'
import type { Categoria, CategoriaTipo, Movimento } from '@/types/categoria'
import { CATEGORIA_TIPO_LABEL } from '@/types/categoria'

export const useCategoriaStore = defineStore('categoria', () => {
  const categorias = ref<Categoria[]>([])
  const loading = ref(false)
  const erro = ref<string | null>(null)
  const carregado = ref(false)

  const porId = computed(() => {
    const mapa = new Map<string, Categoria>()
    for (const categoria of categorias.value) mapa.set(categoria.id, categoria)
    return mapa
  })

  const deEntrada = computed(() => categorias.value.filter((c) => c.movimento === 'ENTRADA'))
  const deSaida = computed(() => categorias.value.filter((c) => c.movimento === 'SAIDA'))

  /** Opções agrupadas por tipo, no formato consumido pelo BaseSelect. */
  function opcoes(movimento: Movimento): OpcaoSelect[] {
    const lista = movimento === 'ENTRADA' ? deEntrada.value : deSaida.value
    return lista.map((categoria) => ({
      label: `${categoria.nome} · ${CATEGORIA_TIPO_LABEL[categoria.tipo]}`,
      value: categoria.id,
    }))
  }

  function nome(id: string | null | undefined): string {
    if (!id) return 'Sem categoria'
    return porId.value.get(id)?.nome ?? 'Sem categoria'
  }

  function cor(id: string | null | undefined): string {
    if (!id) return '#94a3b8'
    return porId.value.get(id)?.cor ?? '#94a3b8'
  }

  function tipo(id: string | null | undefined): CategoriaTipo | null {
    if (!id) return null
    return porId.value.get(id)?.tipo ?? null
  }

  /** Carrega uma única vez por sessão, a menos que `forcar` seja verdadeiro. */
  async function carregar(forcar = false): Promise<void> {
    if (carregado.value && !forcar) return

    loading.value = true
    erro.value = null
    try {
      categorias.value = await categoriaService.listar()
      carregado.value = true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível carregar as categorias.')
    } finally {
      loading.value = false
    }
  }

  return {
    categorias,
    loading,
    erro,
    carregado,
    porId,
    deEntrada,
    deSaida,
    opcoes,
    nome,
    cor,
    tipo,
    carregar,
  }
})
