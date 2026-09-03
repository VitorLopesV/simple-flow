<script setup lang="ts">
import { ArrowDownCircle, CircleCheck, Clock, Plus } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import CategoryFilter from '@/components/features/CategoryFilter.vue'
import MonthPicker from '@/components/features/MonthPicker.vue'
import SummaryCard from '@/components/features/SummaryCard.vue'
import TransactionForm from '@/components/features/TransactionForm.vue'
import TransactionList from '@/components/features/TransactionList.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notificar } from '@/composables/useNotify'
import { useCategoriaStore } from '@/stores/categoriaStore'
import { usePeriodoStore } from '@/stores/periodoStore'
import { useSaidaStore } from '@/stores/saidaStore'
import type { TransacaoCartaoPayload } from '@/types/cartao'
import type { EntradaPayload } from '@/types/entrada'
import type { Saida, SaidaPayload, SaidaStatus } from '@/types/saida'
import { SAIDA_STATUS_OPCOES } from '@/types/saida'
import { formatPeriodo } from '@/utils/dateFormatter'

const periodoStore = usePeriodoStore()
const categoriaStore = useCategoriaStore()
const saidaStore = useSaidaStore()

const modalAberto = ref(false)
const confirmacaoAberta = ref(false)
const emEdicao = ref<Saida | null>(null)
const paraExcluir = ref<Saida | null>(null)

const opcoesCategoria = computed(() => categoriaStore.opcoes('SAIDA'))
const opcoesStatus = computed(() =>
  SAIDA_STATUS_OPCOES.map((opcao) => ({ label: opcao.label, value: opcao.value as string })),
)
const tituloModal = computed(() => (emEdicao.value ? 'Editar saída' : 'Nova saída'))

onMounted(() => void saidaStore.carregar())

watch(() => periodoStore.periodo, () => void saidaStore.carregar(), { deep: true })
watch(
  () => saidaStore.erro,
  (erro) => erro && notificar.erro(erro),
)

function abrirNova(): void {
  emEdicao.value = null
  modalAberto.value = true
}

function abrirEdicao(saida: Saida): void {
  emEdicao.value = saida
  modalAberto.value = true
}

async function salvar(
  payload: EntradaPayload | SaidaPayload | TransacaoCartaoPayload,
): Promise<void> {
  const saida = payload as SaidaPayload
  const editando = emEdicao.value

  const sucesso = editando
    ? await saidaStore.atualizar(editando.id, saida)
    : await saidaStore.criar(saida)

  if (!sucesso) return

  notificar.sucesso(editando ? 'Saída atualizada' : 'Saída adicionada', saida.descricao)
  modalAberto.value = false
  emEdicao.value = null
}

function pedirExclusao(saida: Saida): void {
  paraExcluir.value = saida
  confirmacaoAberta.value = true
}

async function confirmarExclusao(): Promise<void> {
  const saida = paraExcluir.value
  if (!saida) return

  if (await saidaStore.remover(saida.id)) notificar.sucesso('Saída excluída', saida.descricao)
  confirmacaoAberta.value = false
  paraExcluir.value = null
}

async function alternarStatus(saida: Saida): Promise<void> {
  if (await saidaStore.alternarStatus(saida)) {
    notificar.sucesso(
      saida.status === 'PAGO' ? 'Marcada como pendente' : 'Marcada como paga',
      saida.descricao,
    )
  }
}
</script>

<template>
  <PageLayout titulo="Saídas" :descricao="`Despesas de ${formatPeriodo(periodoStore.periodo)}`">
    <template #acoes>
      <MonthPicker
        v-model="periodoStore.periodo"
        class="sm:hidden"
        @hoje="periodoStore.irParaHoje()"
      />
      <BaseButton @click="abrirNova">
        <Plus class="size-4" aria-hidden="true" />
        Nova saída
      </BaseButton>
    </template>

    <div class="grid gap-4 sm:grid-cols-3">
      <SummaryCard
        rotulo="Total de saídas"
        :valor="saidaStore.totalPeriodo"
        :icone="ArrowDownCircle"
        tom="perigo"
        :variacao="saidaStore.variacao"
        variacao-invertida
        :carregando="saidaStore.loading && !saidaStore.resumo"
      />
      <SummaryCard
        rotulo="Já pago"
        :valor="saidaStore.resumo?.totalPago ?? 0"
        :icone="CircleCheck"
        tom="sucesso"
        :variacao="null"
        detalhe="liquidado no período"
        :carregando="saidaStore.loading && !saidaStore.resumo"
      />
      <SummaryCard
        rotulo="Em aberto"
        :valor="saidaStore.resumo?.totalPendente ?? 0"
        :icone="Clock"
        tom="aviso"
        :variacao="null"
        detalhe="aguardando pagamento"
        :carregando="saidaStore.loading && !saidaStore.resumo"
      />
    </div>

    <BaseCard sem-padding>
      <template #cabecalho>
        <h2 class="text-base font-semibold">Lançamentos</h2>
        <p class="text-muted-foreground mt-0.5 text-sm">
          {{ saidaStore.total }} registro(s) encontrados
        </p>
      </template>

      <div class="border-border border-b p-5">
        <CategoryFilter
          :categorias="opcoesCategoria"
          :categoria-id="saidaStore.categoriaId"
          :busca="saidaStore.busca"
          :opcoes-extra="opcoesStatus"
          :valor-extra="saidaStore.status"
          rotulo-extra="Situação"
          :tem-filtro-ativo="saidaStore.temFiltroAtivo"
          @update:categoria-id="saidaStore.filtrarPorCategoria($event)"
          @update:busca="saidaStore.buscar($event)"
          @update:valor-extra="saidaStore.filtrarPorStatus($event as SaidaStatus | null)"
          @limpar="saidaStore.limparFiltros()"
        />
      </div>

      <TransactionList
        tipo="SAIDA"
        :itens="saidaStore.itens"
        :carregando="saidaStore.loading"
        :pagina="saidaStore.page"
        :total-paginas="saidaStore.totalPages"
        :total="saidaStore.total"
        :tamanho-pagina="saidaStore.pageSize"
        titulo-vazio="Nenhuma saída encontrada"
        descricao-vazio="Cadastre suas despesas para acompanhar o quanto já foi gasto no mês."
        @editar="abrirEdicao($event as Saida)"
        @remover="pedirExclusao($event as Saida)"
        @alternar-status="alternarStatus"
        @mudar-pagina="saidaStore.irParaPagina($event)"
      >
        <template #acaoVazio>
          <BaseButton variante="outline" @click="abrirNova">
            <Plus class="size-4" aria-hidden="true" />
            Adicionar saída
          </BaseButton>
        </template>
      </TransactionList>
    </BaseCard>

    <BaseModal v-model:aberto="modalAberto" :titulo="tituloModal">
      <TransactionForm
        tipo="SAIDA"
        :transacao="emEdicao"
        :categorias="opcoesCategoria"
        :salvando="saidaStore.salvando"
        @salvar="salvar"
        @cancelar="modalAberto = false"
      />
    </BaseModal>

    <ConfirmDialog
      v-model:aberto="confirmacaoAberta"
      titulo="Excluir saída"
      :mensagem="`Tem certeza que deseja excluir “${paraExcluir?.descricao ?? ''}”? Esta ação não pode ser desfeita.`"
      texto-confirmar="Excluir"
      :carregando="saidaStore.salvando"
      @confirmar="confirmarExclusao"
    />
  </PageLayout>
</template>
