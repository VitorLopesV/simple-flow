<script setup lang="ts">
import { CreditCard, Plus, Receipt, Wallet } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import CartaoCard from '@/components/features/CartaoCard.vue'
import CartaoForm from '@/components/features/CartaoForm.vue'
import FaturaDetalhe from '@/components/features/FaturaDetalhe.vue'
import MonthPicker from '@/components/features/MonthPicker.vue'
import SummaryCard from '@/components/features/SummaryCard.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notificar } from '@/composables/useNotify'
import { useCartaoStore } from '@/stores/cartaoStore'
import { usePeriodoStore } from '@/stores/periodoStore'
import type { Cartao, CartaoComFatura, CartaoPayload } from '@/types/cartao'
import { formatPeriodo } from '@/utils/dateFormatter'

const periodoStore = usePeriodoStore()
const cartaoStore = useCartaoStore()

const modalAberto = ref(false)
const confirmacaoAberta = ref(false)
const emEdicao = ref<Cartao | null>(null)
const paraExcluir = ref<Cartao | null>(null)

const tituloModal = computed(() => (emEdicao.value ? 'Editar cartão' : 'Novo cartão'))

onMounted(() => void cartaoStore.carregar())
watch(() => periodoStore.periodo, () => void cartaoStore.carregar(), { deep: true })
watch(
  () => cartaoStore.erro,
  (erro) => erro && notificar.erro(erro),
)

function abrirNovo(): void {
  emEdicao.value = null
  modalAberto.value = true
}

function abrirEdicao(item: CartaoComFatura): void {
  emEdicao.value = item.cartao
  modalAberto.value = true
}

async function salvar(payload: CartaoPayload): Promise<void> {
  const editando = emEdicao.value

  const sucesso = editando
    ? await cartaoStore.atualizar(editando.id, payload)
    : await cartaoStore.criar(payload)

  if (!sucesso) return

  notificar.sucesso(editando ? 'Cartão atualizado' : 'Cartão adicionado', payload.nome)
  modalAberto.value = false
  emEdicao.value = null
}

function pedirExclusao(item: CartaoComFatura): void {
  paraExcluir.value = item.cartao
  confirmacaoAberta.value = true
}

async function confirmarExclusao(): Promise<void> {
  const cartao = paraExcluir.value
  if (!cartao) return

  if (await cartaoStore.remover(cartao.id)) {
    notificar.sucesso('Cartão excluído', cartao.nome)
  }
  confirmacaoAberta.value = false
  paraExcluir.value = null
}

async function pagarFatura(faturaId: string): Promise<void> {
  if (await cartaoStore.pagarFatura(faturaId)) notificar.sucesso('Fatura marcada como paga')
}
</script>

<template>
  <PageLayout
    titulo="Cartões de Crédito"
    :descricao="`Faturas e transações de ${formatPeriodo(periodoStore.periodo)}`"
  >
    <template #acoes>
      <MonthPicker
        v-model="periodoStore.periodo"
        class="sm:hidden"
        @hoje="periodoStore.irParaHoje()"
      />
      <BaseButton @click="abrirNovo">
        <Plus class="size-4" aria-hidden="true" />
        Novo cartão
      </BaseButton>
    </template>

    <div class="grid gap-4 sm:grid-cols-3">
      <SummaryCard
        rotulo="Total das faturas"
        :valor="cartaoStore.totalFaturas"
        :icone="Receipt"
        tom="perigo"
        :variacao="null"
        detalhe="no período selecionado"
        :carregando="cartaoStore.loading && !cartaoStore.cartoes.length"
      />
      <SummaryCard
        rotulo="Limite total"
        :valor="cartaoStore.limiteTotal"
        :icone="Wallet"
        tom="info"
        :variacao="null"
        detalhe="somando os cartões ativos"
        :carregando="cartaoStore.loading && !cartaoStore.cartoes.length"
      />
      <div class="bg-card border-border rounded-card border p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <p class="text-muted-foreground text-sm font-medium">Faturas em aberto</p>
          <span class="bg-warning-soft text-warning rounded-lg p-2">
            <CreditCard class="size-4" aria-hidden="true" />
          </span>
        </div>
        <p class="numero-tabular mt-3 text-2xl font-semibold">{{ cartaoStore.faturasEmAberto }}</p>
        <p class="text-muted-foreground mt-2 text-xs">
          de {{ cartaoStore.cartoes.length }} cartão(ões) cadastrado(s)
        </p>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <section class="flex flex-col gap-4" aria-label="Cartões cadastrados">
        <template v-if="cartaoStore.loading && !cartaoStore.cartoes.length">
          <div v-for="i in 2" :key="i" class="bg-card border-border rounded-card border p-4">
            <BaseSkeleton :linhas="3" altura="h-6" />
          </div>
        </template>

        <BaseCard v-else-if="cartaoStore.vazio" sem-padding>
          <EmptyState
            titulo="Nenhum cartão cadastrado"
            descricao="Cadastre um cartão para acompanhar faturas e transações."
          >
            <template #icone>
              <CreditCard class="size-6" aria-hidden="true" />
            </template>
            <template #acao>
              <BaseButton variante="outline" @click="abrirNovo">
                <Plus class="size-4" aria-hidden="true" />
                Adicionar cartão
              </BaseButton>
            </template>
          </EmptyState>
        </BaseCard>

        <template v-else>
          <CartaoCard
            v-for="item in cartaoStore.cartoes"
            :key="item.cartao.id"
            :item="item"
            :selecionado="item.cartao.id === cartaoStore.selecionado?.cartao.id"
            @selecionar="cartaoStore.selecionar($event)"
            @editar="abrirEdicao"
            @remover="pedirExclusao"
          />
        </template>
      </section>

      <FaturaDetalhe
        v-if="cartaoStore.selecionado"
        :item="cartaoStore.selecionado"
        :processando="cartaoStore.salvando"
        @pagar="pagarFatura"
      />
    </div>

    <BaseModal v-model:aberto="modalAberto" :titulo="tituloModal">
      <CartaoForm
        :cartao="emEdicao"
        :salvando="cartaoStore.salvando"
        @salvar="salvar"
        @cancelar="modalAberto = false"
      />
    </BaseModal>

    <ConfirmDialog
      v-model:aberto="confirmacaoAberta"
      titulo="Excluir cartão"
      :mensagem="`Excluir “${paraExcluir?.nome ?? ''}” também remove as faturas e transações vinculadas. Deseja continuar?`"
      texto-confirmar="Excluir"
      :carregando="cartaoStore.salvando"
      @confirmar="confirmarExclusao"
    />
  </PageLayout>
</template>
