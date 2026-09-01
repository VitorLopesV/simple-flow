<script setup lang="ts">
import { Pencil, Repeat, Trash2 } from '@lucide/vue'
import { computed } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BasePagination from '@/components/common/BasePagination.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useCategoriaStore } from '@/stores/categoriaStore'
import type { Movimento } from '@/types/categoria'
import type { Entrada } from '@/types/entrada'
import type { Saida } from '@/types/saida'
import { FORMA_PAGAMENTO_LABEL, SAIDA_STATUS_LABEL } from '@/types/saida'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate } from '@/utils/dateFormatter'

type Transacao = Entrada | Saida

const props = withDefaults(
  defineProps<{
    tipo: Movimento
    itens: Transacao[]
    carregando?: boolean
    pagina: number
    totalPaginas: number
    total: number
    tamanhoPagina: number
    tituloVazio?: string
    descricaoVazio?: string
  }>(),
  {
    carregando: false,
    tituloVazio: 'Nenhum lançamento encontrado',
    descricaoVazio: 'Ajuste os filtros ou adicione um novo lançamento neste período.',
  },
)

const emit = defineEmits<{
  editar: [transacao: Transacao]
  remover: [transacao: Transacao]
  alternarStatus: [transacao: Saida]
  mudarPagina: [pagina: number]
}>()

const categoriaStore = useCategoriaStore()

const ehSaida = computed(() => props.tipo === 'SAIDA')
const corValor = computed(() => (ehSaida.value ? 'text-danger' : 'text-success'))
const sinal = computed(() => (ehSaida.value ? '−' : '+'))

function comoSaida(transacao: Transacao): Saida {
  return transacao as Saida
}

/** Ocorrência projetada de uma recorrência: só o lançamento original é editável/removível. */
function ehProjecaoRecorrente(transacao: Transacao): boolean {
  return Boolean(transacao.origemRecorrenciaId)
}

function bloqueada(transacao: Transacao): boolean {
  return ehProjecaoRecorrente(transacao) || (ehSaida.value && Boolean(comoSaida(transacao).automatica))
}

function textoBloqueio(transacao: Transacao): string {
  return ehSaida.value && comoSaida(transacao).automatica ? 'Ver em Cartões' : 'Editável no original'
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="carregando" class="flex flex-col gap-3 p-5">
      <BaseSkeleton v-for="linha in 5" :key="linha" altura="h-10" />
    </div>

    <EmptyState v-else-if="!itens.length" :titulo="tituloVazio" :descricao="descricaoVazio">
      <template #acao>
        <slot name="acaoVazio" />
      </template>
    </EmptyState>

    <template v-else>
      <!-- Tabela (telas médias em diante) -->
      <div class="scroll-suave hidden overflow-x-auto md:block">
        <table class="w-full text-sm">
          <caption class="sr-only">
            Lista de {{ ehSaida ? 'saídas' : 'entradas' }} do período selecionado
          </caption>
          <thead>
            <tr class="text-muted-foreground border-border border-b text-left">
              <th scope="col" class="px-5 py-3 font-medium">Descrição</th>
              <th scope="col" class="px-5 py-3 font-medium">Categoria</th>
              <th scope="col" class="px-5 py-3 font-medium">Data</th>
              <th v-if="ehSaida" scope="col" class="px-5 py-3 font-medium">Pagamento</th>
              <th v-if="ehSaida" scope="col" class="px-5 py-3 font-medium">Situação</th>
              <th scope="col" class="px-5 py-3 text-right font-medium">Valor</th>
              <th scope="col" class="px-5 py-3 text-right font-medium">
                <span class="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="transacao in itens"
              :key="transacao.id"
              class="border-border hover:bg-muted/50 border-b transition-colors last:border-0"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ transacao.descricao }}</span>
                  <Repeat
                    v-if="transacao.recorrente"
                    class="text-muted-foreground size-3.5 shrink-0"
                    aria-label="Lançamento recorrente"
                  />
                </div>
                <p v-if="transacao.observacao" class="text-muted-foreground truncate text-xs">
                  {{ transacao.observacao }}
                </p>
              </td>

              <td class="px-5 py-3">
                <BaseBadge :cor="categoriaStore.cor(transacao.categoriaId)">
                  {{ categoriaStore.nome(transacao.categoriaId) }}
                </BaseBadge>
              </td>

              <td class="text-muted-foreground numero-tabular px-5 py-3 whitespace-nowrap">
                {{ formatDate(transacao.data) }}
              </td>

              <td v-if="ehSaida" class="text-muted-foreground px-5 py-3 whitespace-nowrap">
                {{ FORMA_PAGAMENTO_LABEL[comoSaida(transacao).formaPagamento] }}
              </td>

              <td v-if="ehSaida" class="px-5 py-3">
                <button
                  v-if="!bloqueada(transacao)"
                  type="button"
                  class="focus-visible:outline-ring rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
                  :title="
                    comoSaida(transacao).status === 'PAGO'
                      ? 'Marcar como pendente'
                      : 'Marcar como pago'
                  "
                  @click="emit('alternarStatus', comoSaida(transacao))"
                >
                  <BaseBadge :tom="comoSaida(transacao).status === 'PAGO' ? 'sucesso' : 'aviso'">
                    {{ SAIDA_STATUS_LABEL[comoSaida(transacao).status] }}
                  </BaseBadge>
                </button>
                <BaseBadge v-else :tom="comoSaida(transacao).status === 'PAGO' ? 'sucesso' : 'aviso'">
                  {{ SAIDA_STATUS_LABEL[comoSaida(transacao).status] }}
                </BaseBadge>
              </td>

              <td class="numero-tabular px-5 py-3 text-right font-semibold" :class="corValor">
                {{ sinal }} {{ formatCurrency(transacao.valor) }}
              </td>

              <td class="px-5 py-3">
                <div v-if="!bloqueada(transacao)" class="flex justify-end gap-1">
                  <BaseButton
                    variante="ghost"
                    tamanho="icon"
                    :aria-label="`Editar ${transacao.descricao}`"
                    @click="emit('editar', transacao)"
                  >
                    <Pencil class="size-4" aria-hidden="true" />
                  </BaseButton>
                  <BaseButton
                    variante="ghost"
                    tamanho="icon"
                    class="hover:text-danger"
                    :aria-label="`Excluir ${transacao.descricao}`"
                    @click="emit('remover', transacao)"
                  >
                    <Trash2 class="size-4" aria-hidden="true" />
                  </BaseButton>
                </div>
                <span v-else class="text-muted-foreground text-xs">{{ textoBloqueio(transacao) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Cartões (mobile) -->
      <ul class="divide-border divide-y md:hidden">
        <li v-for="transacao in itens" :key="transacao.id" class="flex flex-col gap-2 px-4 py-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-medium">{{ transacao.descricao }}</p>
              <p class="text-muted-foreground text-xs">{{ formatDate(transacao.data) }}</p>
            </div>
            <p class="numero-tabular shrink-0 font-semibold" :class="corValor">
              {{ sinal }} {{ formatCurrency(transacao.valor) }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <BaseBadge :cor="categoriaStore.cor(transacao.categoriaId)">
              {{ categoriaStore.nome(transacao.categoriaId) }}
            </BaseBadge>
            <BaseBadge
              v-if="ehSaida"
              :tom="comoSaida(transacao).status === 'PAGO' ? 'sucesso' : 'aviso'"
            >
              {{ SAIDA_STATUS_LABEL[comoSaida(transacao).status] }}
            </BaseBadge>

            <div v-if="!bloqueada(transacao)" class="ml-auto flex gap-1">
              <BaseButton
                variante="ghost"
                tamanho="icon"
                :aria-label="`Editar ${transacao.descricao}`"
                @click="emit('editar', transacao)"
              >
                <Pencil class="size-4" aria-hidden="true" />
              </BaseButton>
              <BaseButton
                variante="ghost"
                tamanho="icon"
                class="hover:text-danger"
                :aria-label="`Excluir ${transacao.descricao}`"
                @click="emit('remover', transacao)"
              >
                <Trash2 class="size-4" aria-hidden="true" />
              </BaseButton>
            </div>
            <span v-else class="text-muted-foreground ml-auto text-xs">{{ textoBloqueio(transacao) }}</span>
          </div>
        </li>
      </ul>

      <div class="px-5 pb-5">
        <BasePagination
          :pagina="pagina"
          :total-paginas="totalPaginas"
          :total="total"
          :tamanho-pagina="tamanhoPagina"
          @mudar="emit('mudarPagina', $event)"
        />
      </div>
    </template>
  </div>
</template>
