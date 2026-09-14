<script setup lang="ts">
import { ArrowUpCircle, Hash, Plus, Sigma } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import CategoryFilter from '@/components/features/CategoryFilter.vue'
import MonthPicker from '@/components/features/MonthPicker.vue'
import StatisticsChart from '@/components/features/StatisticsChart.vue'
import SummaryCard from '@/components/features/SummaryCard.vue'
import TransactionForm from '@/components/features/TransactionForm.vue'
import TransactionList from '@/components/features/TransactionList.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notificar } from '@/composables/useNotify'
import { useCategoriaStore } from '@/stores/categoriaStore'
import { useEntradaStore } from '@/stores/entradaStore'
import { usePeriodoStore } from '@/stores/periodoStore'
import type { TransacaoCartaoPayload } from '@/types/cartao'
import type { Entrada, EntradaPayload, EntradaResumo } from '@/types/entrada'
import type { SaidaPayload } from '@/types/saida'
import { formatPeriodo } from '@/utils/dateFormatter'

const periodoStore = usePeriodoStore()
const categoriaStore = useCategoriaStore()
const entradaStore = useEntradaStore()

const modalAberto = ref(false)
const confirmacaoAberta = ref(false)
const emEdicao = ref<Entrada | null>(null)
const paraExcluir = ref<Entrada | null>(null)

const opcoesCategoria = computed(() => categoriaStore.opcoes('ENTRADA'))
const tituloModal = computed(() => (emEdicao.value ? 'Editar entrada' : 'Nova entrada'))

// Cobre qualquer categoria de entrada (salário, benefício, dinheiro avulso...) sem
// depender de nenhuma categoria específica existir — reforça visualmente a
// composição das receitas do período, hoje só disponível como número em `resumo`.
const porCategoria = computed<EntradaResumo['porCategoria']>(
  () => entradaStore.resumo?.porCategoria ?? [],
)
const labelsCategoria = computed(() => porCategoria.value.map((item) => item.nome))
const seriesCategoria = computed(() => [
  { nome: 'Entradas', dados: porCategoria.value.map((item) => item.total), cor: '#10b981' },
])
const coresCategoria = computed(() => porCategoria.value.map((item) => item.cor))

onMounted(() => void entradaStore.carregar())
watch(() => periodoStore.periodo, () => void entradaStore.carregar(), { deep: true })
watch(
  () => entradaStore.erro,
  (erro) => erro && notificar.erro(erro),
)

function abrirNova(): void {
  emEdicao.value = null
  modalAberto.value = true
}

function abrirEdicao(entrada: Entrada): void {
  emEdicao.value = entrada
  modalAberto.value = true
}

async function salvar(
  payload: EntradaPayload | SaidaPayload | TransacaoCartaoPayload,
): Promise<void> {
  const entrada = payload as EntradaPayload
  const editando = emEdicao.value

  const sucesso = editando
    ? await entradaStore.atualizar(editando.id, entrada)
    : await entradaStore.criar(entrada)

  if (!sucesso) return

  notificar.sucesso(editando ? 'Entrada atualizada' : 'Entrada adicionada', entrada.descricao)
  modalAberto.value = false
  emEdicao.value = null
}

function pedirExclusao(entrada: Entrada): void {
  paraExcluir.value = entrada
  confirmacaoAberta.value = true
}

async function confirmarExclusao(): Promise<void> {
  const entrada = paraExcluir.value
  if (!entrada) return

  if (await entradaStore.remover(entrada.id)) {
    notificar.sucesso('Entrada excluída', entrada.descricao)
  }
  confirmacaoAberta.value = false
  paraExcluir.value = null
}
</script>

<template>
  <PageLayout titulo="Entradas" :descricao="`Receitas de ${formatPeriodo(periodoStore.periodo)}`">
    <template #acoes>
      <MonthPicker
        v-model="periodoStore.periodo"
        class="sm:hidden"
        @hoje="periodoStore.irParaHoje()"
      />
      <BaseButton @click="abrirNova">
        <Plus class="size-4" aria-hidden="true" />
        Nova entrada
      </BaseButton>
    </template>

    <div class="grid gap-4 sm:grid-cols-3">
      <SummaryCard
        rotulo="Total de entradas"
        :valor="entradaStore.totalPeriodo"
        :icone="ArrowUpCircle"
        tom="sucesso"
        :variacao="entradaStore.variacao"
        :carregando="entradaStore.loading && !entradaStore.resumo"
      />
      <SummaryCard
        rotulo="Ticket médio"
        :valor="entradaStore.resumo?.media ?? 0"
        :icone="Sigma"
        tom="info"
        detalhe="por lançamento"
        :carregando="entradaStore.loading && !entradaStore.resumo"
      />
      <div class="bg-card border-border rounded-card border p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <p class="text-muted-foreground text-sm font-medium">Lançamentos</p>
          <span class="bg-muted text-muted-foreground rounded-lg p-2">
            <Hash class="size-4" aria-hidden="true" />
          </span>
        </div>
        <p class="numero-tabular mt-3 text-2xl font-semibold">
          {{ entradaStore.resumo?.quantidade ?? 0 }}
        </p>
        <p class="text-muted-foreground mt-2 text-xs">no período selecionado</p>
      </div>
    </div>

    <BaseCard titulo="Entradas por categoria" :descricao="formatPeriodo(periodoStore.periodo)">
      <BaseSkeleton v-if="entradaStore.loading && !entradaStore.resumo" altura="h-64" />
      <EmptyState
        v-else-if="!porCategoria.length"
        titulo="Sem entradas no período"
        descricao="Registre um salário, benefício ou outra receita para ver a composição aqui."
      />
      <StatisticsChart
        v-else
        tipo="rosca"
        :labels="labelsCategoria"
        :series="seriesCategoria"
        :cores="coresCategoria"
        :altura="280"
      />
    </BaseCard>

    <BaseCard sem-padding>
      <template #cabecalho>
        <h2 class="text-base font-semibold">Lançamentos</h2>
        <p class="text-muted-foreground mt-0.5 text-sm">
          {{ entradaStore.total }} registro(s) encontrados
        </p>
      </template>

      <div class="border-border border-b p-5">
        <CategoryFilter
          :categorias="opcoesCategoria"
          :categoria-id="entradaStore.categoriaId"
          :busca="entradaStore.busca"
          :tem-filtro-ativo="entradaStore.temFiltroAtivo"
          @update:categoria-id="entradaStore.filtrarPorCategoria($event)"
          @update:busca="entradaStore.buscar($event)"
          @limpar="entradaStore.limparFiltros()"
        />
      </div>

      <TransactionList
        tipo="ENTRADA"
        :itens="entradaStore.itens"
        :carregando="entradaStore.loading"
        :pagina="entradaStore.page"
        :total-paginas="entradaStore.totalPages"
        :total="entradaStore.total"
        :tamanho-pagina="entradaStore.pageSize"
        titulo-vazio="Nenhuma entrada encontrada"
        descricao-vazio="Registre suas receitas para acompanhar o total do mês."
        @editar="abrirEdicao($event as Entrada)"
        @remover="pedirExclusao($event as Entrada)"
        @mudar-pagina="entradaStore.irParaPagina($event)"
      >
        <template #acaoVazio>
          <BaseButton variante="outline" @click="abrirNova">
            <Plus class="size-4" aria-hidden="true" />
            Adicionar entrada
          </BaseButton>
        </template>
      </TransactionList>
    </BaseCard>

    <BaseModal v-model:aberto="modalAberto" :titulo="tituloModal">
      <TransactionForm
        tipo="ENTRADA"
        :transacao="emEdicao"
        :categorias="opcoesCategoria"
        :salvando="entradaStore.salvando"
        @salvar="salvar"
        @cancelar="modalAberto = false"
      />
    </BaseModal>

    <ConfirmDialog
      v-model:aberto="confirmacaoAberta"
      titulo="Excluir entrada"
      :mensagem="`Tem certeza que deseja excluir “${paraExcluir?.descricao ?? ''}”? Esta ação não pode ser desfeita.`"
      texto-confirmar="Excluir"
      :carregando="entradaStore.salvando"
      @confirmar="confirmarExclusao"
    />
  </PageLayout>
</template>
