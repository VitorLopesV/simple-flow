<script setup lang="ts">
import { ArrowDownCircle, ArrowUpCircle, CreditCard, Download, Wallet } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MonthPicker from '@/components/features/MonthPicker.vue'
import StatisticsChart from '@/components/features/StatisticsChart.vue'
import SummaryCard from '@/components/features/SummaryCard.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { notificar } from '@/composables/useNotify'
import { exportarRelatorioPdf } from '@/services/exportService'
import { mensagemDeErro } from '@/services/http'
import { useAuthStore } from '@/stores/authStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { usePeriodoStore } from '@/stores/periodoStore'
import { SAIDA_TIPO_COR, SAIDA_TIPO_LABEL } from '@/types/saida'
import { formatCurrency, formatPercent } from '@/utils/currencyFormatter'
import { formatDate, formatPeriodo } from '@/utils/dateFormatter'

const authStore = useAuthStore()
const periodoStore = usePeriodoStore()
const dashboardStore = useDashboardStore()

/**
 * Nome do cadastro; se não houver (login em modo mock ou conta antiga), usa o trecho do
 * e-mail antes do `@`, capitalizado — o endereço completo nunca aparece na saudação.
 */
const nomeUsuario = computed(() => {
  const nome = authStore.usuario?.nome?.trim()
  if (nome) return nome

  const local = authStore.usuario?.email?.split('@')[0]?.split(/[._\-+\d]/)[0] ?? ''
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : ''
})

const SAUDACAO = 'Olá, seja bem-vindo'
const INTERVALO_DIGITACAO_MS = 45

/** Quantos caracteres de "saudação + espaço + nome" já foram "digitados". */
const digitados = ref(0)
let timerDigitacao: ReturnType<typeof setInterval> | undefined

const textoCompleto = computed(() =>
  nomeUsuario.value ? `${SAUDACAO} ${nomeUsuario.value}` : SAUDACAO,
)
const saudacaoVisivel = computed(() => textoCompleto.value.slice(0, digitados.value).slice(0, SAUDACAO.length))
// O espaço separador fica no início do trecho do nome, fora do texto da saudação.
const nomeVisivel = computed(() => textoCompleto.value.slice(SAUDACAO.length, digitados.value))
const digitando = computed(() => digitados.value < textoCompleto.value.length)

function pararDigitacao(): void {
  clearInterval(timerDigitacao)
  timerDigitacao = undefined
}

/** Efeito de máquina de escrever a cada abertura do painel; sem animação se o usuário pediu menos movimento. */
function iniciarDigitacao(): void {
  pararDigitacao()

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    digitados.value = textoCompleto.value.length
    return
  }

  digitados.value = 0
  timerDigitacao = setInterval(() => {
    digitados.value += 1
    if (!digitando.value) pararDigitacao()
  }, INTERVALO_DIGITACAO_MS)
}

watch(nomeUsuario, iniciarDigitacao)
onBeforeUnmount(pararDigitacao)

const exportando = ref(false)

async function exportarDados(): Promise<void> {
  exportando.value = true
  try {
    await exportarRelatorioPdf(periodoStore.periodo)
    notificar.sucesso('Relatório exportado', formatPeriodo(periodoStore.periodo))
  } catch (erro) {
    notificar.erro(mensagemDeErro(erro, 'Não foi possível gerar o PDF do relatório.'))
  } finally {
    exportando.value = false
  }
}

const resumo = computed(() => dashboardStore.resumo)
const carregandoInicial = computed(() => dashboardStore.loading && !resumo.value)

const labelsHistorico = computed(() => resumo.value?.serieEntradas.map((p) => p.label) ?? [])

const seriesHistorico = computed(() => [
  {
    nome: 'Entradas',
    dados: resumo.value?.serieEntradas.map((p) => p.valor) ?? [],
    cor: '#10b981',
  },
  { nome: 'Saídas', dados: resumo.value?.serieSaidas.map((p) => p.valor) ?? [], cor: '#f43f5e' },
])

/**
 * `totalFaturas` é um recorte de `totalSaidas` (a fatura já está somada ali), não
 * uma parcela a mais — o detalhe do card diz o peso dela pra não parecer que soma.
 */
const detalheFaturas = computed(() => {
  const total = resumo.value?.totalSaidas ?? 0
  const faturas = resumo.value?.totalFaturas ?? 0

  if (!faturas) return 'nenhuma fatura vence neste mês'
  return total > 0 ? `${formatPercent(faturas / total)} das saídas do mês` : 'incluído nas saídas do mês'
})

const gastos = computed(() => resumo.value?.gastosPorCategoria.slice(0, 6) ?? [])
const labelsGastos = computed(() => gastos.value.map((g) => g.nome))
const seriesGastos = computed(() => [
  { nome: 'Gastos', dados: gastos.value.map((g) => g.total), cor: '#6366f1' },
])
const coresGastos = computed(() => gastos.value.map((g) => g.cor))

// `porTipo` vem do resumo de saídas (`/saidas/resumo`) via dashboardStore.
const tipos = computed(() => dashboardStore.gastosPorTipo.slice(0, 6))
const labelsTipos = computed(() => tipos.value.map((t) => SAIDA_TIPO_LABEL[t.tipo]))
const seriesTipos = computed(() => [
  { nome: 'Gastos', dados: tipos.value.map((t) => t.total), cor: '#6366f1' },
])
const coresTipos = computed(() => tipos.value.map((t) => SAIDA_TIPO_COR[t.tipo]))

// `?? []` cobre um backend que ainda não devolva `entradasPorCategoria`.
const entradas = computed(() => resumo.value?.entradasPorCategoria?.slice(0, 6) ?? [])
const labelsEntradas = computed(() => entradas.value.map((e) => e.nome))
const seriesEntradas = computed(() => [
  { nome: 'Entradas', dados: entradas.value.map((e) => e.total), cor: '#10b981' },
])
const coresEntradas = computed(() => entradas.value.map((e) => e.cor))

onMounted(() => {
  iniciarDigitacao()
  void dashboardStore.carregar()
})
watch(() => periodoStore.periodo, () => void dashboardStore.carregar(), { deep: true })
watch(
  () => dashboardStore.erro,
  (erro) => erro && notificar.erro(erro),
)
</script>

<template>
  <div class="flex w-full flex-col gap-10">
  <h2
    data-testid="saudacao"
    :aria-label="textoCompleto"
    class="text-foreground text-2xl font-extralight tracking-tight wrap-break-word whitespace-pre-wrap sm:text-4xl"
  >
    <span aria-hidden="true">{{ saudacaoVisivel }}</span>
    <span aria-hidden="true" class="text-primary font-semibold">{{ nomeVisivel }}</span>
    <span
      v-if="digitando"
      aria-hidden="true"
      class="bg-primary ml-1 inline-block h-[0.9em] w-0.5 translate-y-[0.1em] animate-pulse"
    />
  </h2>

  <PageLayout
    titulo="Visão geral"
    :descricao="`Resumo financeiro de ${formatPeriodo(periodoStore.periodo)}`"
  >
    <template #acoes>
      <MonthPicker
        v-model="periodoStore.periodo"
        @hoje="periodoStore.irParaHoje()"
      />
      <BaseButton variante="outline" class="!h-11" :carregando="exportando" @click="exportarDados">
        <Download class="size-4" aria-hidden="true" />
        Exportar dados
      </BaseButton>
    </template>

    <div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <SummaryCard
        rotulo="Entradas"
        :valor="resumo?.totalEntradas ?? 0"
        :icone="ArrowUpCircle"
        tom="sucesso"
        :variacao="resumo?.variacaoEntradas ?? null"
        :carregando="carregandoInicial"
      />
      <SummaryCard
        rotulo="Saídas"
        :valor="resumo?.totalSaidas ?? 0"
        :icone="ArrowDownCircle"
        tom="perigo"
        :variacao="resumo?.variacaoSaidas ?? null"
        variacao-invertida
        :carregando="carregandoInicial"
      />
      <SummaryCard
        rotulo="Faturas de cartão"
        :valor="resumo?.totalFaturas ?? 0"
        :icone="CreditCard"
        tom="aviso"
        :variacao="null"
        :detalhe="detalheFaturas"
        :carregando="carregandoInicial"
      />
      <SummaryCard
        rotulo="Saldo do mês"
        :valor="resumo?.saldo ?? 0"
        :icone="Wallet"
        :tom="dashboardStore.saldoPositivo ? 'sucesso' : 'perigo'"
        :variacao="null"
        :detalhe="dashboardStore.saldoPositivo ? 'sobrou no período' : 'déficit no período'"
        :carregando="carregandoInicial"
      />
    </div>

    <div class="grid gap-6">
      <BaseCard titulo="Entradas x Saídas" descricao="Evolução dos últimos 6 meses">
        <BaseSkeleton v-if="carregandoInicial" altura="h-64" />
        <StatisticsChart
          v-else
          tipo="barra"
          :labels="labelsHistorico"
          :series="seriesHistorico"
          :altura="280"
        />
      </BaseCard>
    </div>

    <div class="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
      <BaseCard titulo="Gastos por categoria" :descricao="formatPeriodo(periodoStore.periodo)">
        <BaseSkeleton v-if="carregandoInicial" altura="h-64" />
        <EmptyState
          v-else-if="!gastos.length"
          titulo="Sem gastos no período"
          descricao="Nenhuma saída registrada para este mês."
        />
        <StatisticsChart
          v-else
          tipo="rosca"
          :labels="labelsGastos"
          :series="seriesGastos"
          :cores="coresGastos"
          :altura="280"
        />
      </BaseCard>
      <BaseCard titulo="Gastos por tipo" :descricao="formatPeriodo(periodoStore.periodo)">
        <BaseSkeleton v-if="carregandoInicial" altura="h-64" />
        <EmptyState
          v-else-if="!tipos.length"
          titulo="Sem gastos no período"
          descricao="Nenhuma saída registrada para este mês."
        />
        <StatisticsChart
          v-else
          tipo="rosca"
          :labels="labelsTipos"
          :series="seriesTipos"
          :cores="coresTipos"
          :altura="280"
        />
      </BaseCard>
      <BaseCard
        titulo="Entradas por categoria"
        :descricao="formatPeriodo(periodoStore.periodo)"
        class="md:col-span-2 2xl:col-span-1"
      >
        <BaseSkeleton v-if="carregandoInicial" altura="h-64" />
        <EmptyState
          v-else-if="!entradas.length"
          titulo="Sem entradas no período"
          descricao="Nenhuma entrada registrada para este mês."
        />
        <StatisticsChart
          v-else
          tipo="rosca"
          :labels="labelsEntradas"
          :series="seriesEntradas"
          :cores="coresEntradas"
          :altura="280"
        />
      </BaseCard>
    </div>

    <div class="grid gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <BaseCard sem-padding>
        <template #cabecalho>
          <h2 class="text-base font-semibold">Últimas transações</h2>
          <p class="text-muted-foreground mt-0.5 text-sm">Movimentações mais recentes do período</p>
        </template>

        <div v-if="carregandoInicial" class="flex flex-col gap-3 p-5">
          <BaseSkeleton v-for="linha in 5" :key="linha" altura="h-9" />
        </div>

        <EmptyState
          v-else-if="!resumo?.transacoesRecentes.length"
          titulo="Nenhuma movimentação"
          descricao="Adicione entradas ou saídas para ver o histórico aqui."
        />

        <ul v-else class="divide-border divide-y">
          <li
            v-for="transacao in resumo.transacoesRecentes"
            :key="`${transacao.tipo}-${transacao.id}`"
            class="flex items-center justify-between gap-3 px-5 py-3"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full"
                :class="
                  transacao.tipo === 'ENTRADA'
                    ? 'bg-success-soft text-success'
                    : 'bg-danger-soft text-danger'
                "
              >
                <ArrowUpCircle
                  v-if="transacao.tipo === 'ENTRADA'"
                  class="size-4"
                  aria-hidden="true"
                />
                <ArrowDownCircle v-else class="size-4" aria-hidden="true" />
              </span>

              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ transacao.descricao }}</p>
                <div class="mt-0.5 flex items-center gap-2">
                  <BaseBadge :cor="transacao.categoriaCor">{{ transacao.categoriaNome }}</BaseBadge>
                  <span class="text-muted-foreground text-xs">{{ formatDate(transacao.data) }}</span>
                </div>
              </div>
            </div>

            <p
              class="numero-tabular shrink-0 text-sm font-semibold"
              :class="transacao.tipo === 'ENTRADA' ? 'text-success' : 'text-danger'"
            >
              {{ transacao.tipo === 'ENTRADA' ? '+' : '−' }} {{ formatCurrency(transacao.valor) }}
            </p>
          </li>
        </ul>
      </BaseCard>

      <BaseCard titulo="Comprometimento da renda" descricao="Quanto das entradas já foi gasto">
        <BaseSkeleton v-if="carregandoInicial" :linhas="3" />
        <template v-else>
          <p class="numero-tabular text-3xl font-semibold">
            {{ Math.round(dashboardStore.comprometimento) }}%
          </p>
          <div class="bg-muted mt-3 h-2 w-full overflow-hidden rounded-full">
            <div
              class="h-full rounded-full transition-all"
              :class="
                dashboardStore.comprometimento >= 90
                  ? 'bg-danger'
                  : dashboardStore.comprometimento >= 70
                    ? 'bg-warning'
                    : 'bg-success'
              "
              :style="{ width: `${dashboardStore.comprometimento}%` }"
              role="progressbar"
              :aria-valuenow="Math.round(dashboardStore.comprometimento)"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Percentual da renda comprometido"
            />
          </div>

          <dl class="mt-5 space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">Entradas</dt>
              <dd class="numero-tabular text-success font-medium">
                {{ formatCurrency(resumo?.totalEntradas ?? 0) }}
              </dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">Saídas</dt>
              <dd class="numero-tabular text-danger font-medium">
                {{ formatCurrency(resumo?.totalSaidas ?? 0) }}
              </dd>
            </div>
            <div class="border-border flex items-center justify-between border-t pt-3">
              <dt class="font-medium">Saldo</dt>
              <dd
                class="numero-tabular font-semibold"
                :class="dashboardStore.saldoPositivo ? 'text-success' : 'text-danger'"
              >
                {{ formatCurrency(resumo?.saldo ?? 0) }}
              </dd>
            </div>
          </dl>
        </template>
      </BaseCard>
    </div>
  </PageLayout>
  </div>
</template>
