<script setup lang="ts">
import { ArrowDownCircle, ArrowUpCircle, CreditCard, Download, Wallet } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ExpenseSourceToggle, { type ExpenseSource } from '@/components/features/ExpenseSourceToggle.vue'
import MonthPicker from '@/components/features/MonthPicker.vue'
import StatisticsChart from '@/components/features/StatisticsChart.vue'
import SummaryCard from '@/components/features/SummaryCard.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import recentTransactionsIcon from '@/img/last_transitions_icon.svg'
import { notify } from '@/composables/useNotify'
import { exportPdfReport } from '@/services/exportService'
import { getErrorMessage } from '@/services/http'
import { useAuthStore } from '@/stores/authStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { usePeriodStore } from '@/stores/periodStore'
import { EXPENSE_TYPE_COLOR, EXPENSE_TYPE_LABEL } from '@/types/expense'
import { formatCurrency, formatPercent } from '@/utils/currencyFormatter'
import { formatDate, formatPeriod } from '@/utils/dateFormatter'

const authStore = useAuthStore()
const periodStore = usePeriodStore()
const dashboardStore = useDashboardStore()

/**
 * Nome do cadastro; se não houver (login em modo mock ou conta antiga), usa o trecho do
 * e-mail antes do `@`, capitalizado — o endereço completo nunca aparece na saudação.
 */
const userName = computed(() => {
  const name = authStore.user?.name?.trim()
  if (name) return name

  const local = authStore.user?.email?.split('@')[0]?.split(/[._\-+\d]/)[0] ?? ''
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : ''
})

const GREETING = 'Olá, seja bem-vindo'
const TYPING_INTERVAL_MS = 45

/** Quantos caracteres de "saudação + espaço + nome" já foram "digitados". */
const typedCount = ref(0)
let typingTimer: ReturnType<typeof setInterval> | undefined

const fullText = computed(() =>
  userName.value ? `${GREETING} ${userName.value}` : GREETING,
)
const visibleGreeting = computed(() => fullText.value.slice(0, typedCount.value).slice(0, GREETING.length))
// O espaço separador fica no início do trecho do nome, fora do texto da saudação.
const visibleName = computed(() => fullText.value.slice(GREETING.length, typedCount.value))
const isTyping = computed(() => typedCount.value < fullText.value.length)

function stopTyping(): void {
  clearInterval(typingTimer)
  typingTimer = undefined
}

/** Efeito de máquina de escrever a cada abertura do painel; sem animação se o usuário pediu menos movimento. */
function startTyping(): void {
  stopTyping()

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    typedCount.value = fullText.value.length
    return
  }

  typedCount.value = 0
  typingTimer = setInterval(() => {
    typedCount.value += 1
    if (!isTyping.value) stopTyping()
  }, TYPING_INTERVAL_MS)
}

watch(userName, startTyping)
onBeforeUnmount(() => {
  stopTyping()
  window.removeEventListener('keydown', closeOnEscape)
})

const exporting = ref(false)

/**
 * O SVG tem `fill` fixo, então vira máscara: a cor vem de `bg-current` e acompanha o tema.
 * A URL vai entre aspas porque o Vite pode inlinar o arquivo como data URI.
 */
const recentTransactionsIconStyle = {
  maskImage: `url("${recentTransactionsIcon}")`,
  WebkitMaskImage: `url("${recentTransactionsIcon}")`,
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
}

/** Painel lateral de últimas transações: oculto por padrão, aberto sob demanda. */
const transactionsOpen = ref(false)

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') transactionsOpen.value = false
}

async function exportData(): Promise<void> {
  exporting.value = true
  try {
    await exportPdfReport(periodStore.period)
    notify.success('Relatório exportado', formatPeriod(periodStore.period))
  } catch (error) {
    notify.error(getErrorMessage(error, 'Não foi possível gerar o PDF do relatório.'))
  } finally {
    exporting.value = false
  }
}

const summary = computed(() => dashboardStore.summary)
const initialLoading = computed(() => dashboardStore.loading && !summary.value)

const historyLabels = computed(() => summary.value?.incomeSeries.map((p) => p.label) ?? [])

const historySeries = computed(() => [
  {
    name: 'Entradas',
    data: summary.value?.incomeSeries.map((p) => p.value) ?? [],
    color: '#10b981',
  },
  { name: 'Saídas', data: summary.value?.expenseSeries.map((p) => p.value) ?? [], color: '#f43f5e' },
])

/**
 * O gráfico de barras separa as saídas em "sem cartão" e "cartões": a fatura já está
 * somada em `expenseSeries`, então é subtraída para não aparecer duas vezes.
 */
const barSeries = computed(() => {
  const expenses = summary.value?.expenseSeries ?? []
  const invoices = summary.value?.invoiceSeries ?? []
  const monthInvoice = (index: number) => invoices[index]?.value ?? 0

  return [
    { name: 'Entradas', data: summary.value?.incomeSeries.map((p) => p.value) ?? [], color: '#10b981' },
    {
      name: 'Saídas',
      data: expenses.map((p, index) => Math.max(0, p.value - monthInvoice(index))),
      color: '#f43f5e',
    },
    { name: 'Cartões', data: expenses.map((_, index) => monthInvoice(index)), color: '#f59e0b' },
  ]
})

/**
 * `totalInvoices` é um recorte de `totalExpenses` (a fatura já está somada ali), não
 * uma parcela a mais — o detalhe do card diz o peso dela pra não parecer que soma.
 */
const invoicesDetail = computed(() => {
  const total = summary.value?.totalExpenses ?? 0
  const invoices = summary.value?.totalInvoices ?? 0

  if (!invoices) return 'nenhuma fatura vence neste mês'
  return total > 0 ? `${formatPercent(invoices / total)} das saídas do mês` : 'incluído nas saídas do mês'
})

/**
 * Quanto do que entrou no mês já foi consumido pelas saídas (mesmo cálculo do store,
 * limitado a 100%). Sem entradas não há base de comparação, então o texto explica o caso.
 */
const balanceDetail = computed(() => {
  const income = summary.value?.totalIncome ?? 0
  const expenses = summary.value?.totalExpenses ?? 0

  if (!income) return expenses > 0 ? '100% consumido, sem entradas no mês' : 'sem movimentações no mês'
  if (!expenses) return '0% consumido'

  return `${Math.round(dashboardStore.incomeCommitment)}% consumido`
})

/** Qual conjunto o gráfico "Gastos por categoria" plota — mesmo esquema de "Gastos por tipo". */
const categorySource = ref<ExpenseSource>('expenses')

/**
 * Saídas: a fatura entra inteira na categoria da saída derivada ("Despesa Variável").
 * Cartões: as transações dessas faturas, cada uma na sua categoria; `?? []` cobre um
 * backend que ainda não devolva `gastosCartoesPorCategoria`.
 */
const spending = computed(() =>
  (categorySource.value === 'cards'
    ? (summary.value?.cardExpensesByCategory ?? [])
    : (summary.value?.expensesByCategory ?? [])
  ).slice(0, 6),
)
const spendingLabels = computed(() => spending.value.map((item) => item.name))
const spendingSeries = computed(() => [
  { name: 'Gastos', data: spending.value.map((item) => item.total), color: '#6366f1' },
])
const spendingColors = computed(() => spending.value.map((item) => item.color))

/** Qual conjunto o gráfico "Gastos por tipo" plota — o gráfico é o mesmo, só os dados trocam. */
const typeSource = ref<ExpenseSource>('expenses')

/**
 * Saídas: `byType` do resumo de saídas (`/saidas/resumo`) via dashboardStore — a fatura
 * entra inteira como "Conta". Cartões: as transações dessas faturas, cada uma no seu tipo;
 * `?? []` cobre um backend que ainda não devolva `gastosCartoesPorTipo`.
 */
const types = computed(() =>
  (typeSource.value === 'cards'
    ? (summary.value?.cardExpensesByType ?? [])
    : dashboardStore.expensesByType
  ).slice(0, 6),
)
const typeLabels = computed(() => types.value.map((item) => EXPENSE_TYPE_LABEL[item.type]))
const typeSeries = computed(() => [
  { name: 'Gastos', data: types.value.map((item) => item.total), color: '#6366f1' },
])
const typeColors = computed(() => types.value.map((item) => EXPENSE_TYPE_COLOR[item.type]))

const incomes = computed(() => summary.value?.incomeByCategory.slice(0, 6) ?? [])
const incomeLabels = computed(() => incomes.value.map((item) => item.name))
const incomeSeries = computed(() => [
  { name: 'Entradas', data: incomes.value.map((item) => item.total), color: '#10b981' },
])
const incomeColors = computed(() => incomes.value.map((item) => item.color))

onMounted(() => {
  window.addEventListener('keydown', closeOnEscape)
  startTyping()
  void dashboardStore.load()
})
watch(() => periodStore.period, () => void dashboardStore.load(), { deep: true })
watch(
  () => dashboardStore.error,
  (error) => error && notify.error(error),
)
</script>

<template>
  <div class="flex w-full flex-col gap-10 md:h-full md:min-h-0 md:gap-6">
  <h2
    data-testid="greeting"
    :aria-label="fullText"
    class="text-foreground text-2xl font-extralight tracking-tight wrap-break-word whitespace-pre-wrap sm:text-4xl"
  >
    <span aria-hidden="true">{{ visibleGreeting }}</span>
    <span aria-hidden="true" class="text-success font-semibold">{{ visibleName }}</span>
    <span
      v-if="isTyping"
      aria-hidden="true"
      class="bg-primary ml-1 inline-block h-[0.9em] w-0.5 translate-y-[0.1em] animate-pulse"
    />
  </h2>

  <PageLayout
    class="md:min-h-0 md:flex-1"
    title="Visão geral"
    :description="`Resumo financeiro de ${formatPeriod(periodStore.period)}`"
  >
    <template #actions>
      <MonthPicker
        v-model="periodStore.period"
        :min="periodStore.minPeriod"
        :max="periodStore.maxPeriod"
        @today="periodStore.goToToday()"
      />
      <BaseButton variant="outline" class="!h-11" :loading="exporting" @click="exportData">
        <Download class="size-4" aria-hidden="true" />
        Exportar dados
      </BaseButton>
      <BaseButton
        variant="outline"
        class="!h-11 !w-11 justify-center !px-0"
        :class="transactionsOpen ? '!bg-success !border-success !text-success-foreground hover:!bg-success/90' : ''"
        aria-label="Últimas transações"
        title="Últimas transações"
        aria-controls="recent-transactions-panel"
        :aria-expanded="transactionsOpen"
        @click="transactionsOpen = !transactionsOpen"
      >
        <span
          class="inline-block size-7 bg-current"
          :style="recentTransactionsIconStyle"
          aria-hidden="true"
        />
      </BaseButton>
    </template>

    <div class="flex flex-col gap-6 md:min-h-0 md:flex-1 md:flex-row md:items-stretch md:gap-0">
      <div class="@container flex min-w-0 flex-1 flex-col gap-4 md:min-h-0">
        <div class="grid shrink-0 grid-cols-1 gap-4 @lg:grid-cols-2 @3xl:grid-cols-4">
          <SummaryCard
            label="Entradas"
            :value="summary?.totalIncome ?? 0"
            :icon="ArrowUpCircle"
            tone="success"
            :change="summary?.incomeChange ?? null"
            :loading="initialLoading"
          />
          <SummaryCard
            label="Saídas"
            :value="summary?.totalExpenses ?? 0"
            :icon="ArrowDownCircle"
            tone="danger"
            :change="summary?.expenseChange ?? null"
            inverted-change
            :loading="initialLoading"
          />
          <SummaryCard
            label="Faturas de cartão"
            :value="summary?.totalInvoices ?? 0"
            :icon="CreditCard"
            tone="warning"
            :change="null"
            :detail="invoicesDetail"
            :loading="initialLoading"
          />
          <SummaryCard
            label="Saldo do mês"
            :value="summary?.balance ?? 0"
            :icon="Wallet"
            :tone="dashboardStore.isBalancePositive ? 'success' : 'danger'"
            :change="null"
            :detail="balanceDetail"
            :loading="initialLoading"
          />
        </div>

        <div class="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-rows-2">
          <div class="grid grid-cols-1 gap-4 md:min-h-0 md:grid-cols-2">
            <BaseCard fill title="Entradas x Saídas" description="Evolução dos últimos 6 meses">
              <BaseSkeleton v-if="initialLoading" height="h-64 md:h-full" />
              <StatisticsChart
                v-else
                fill
                type="bar"
                :labels="historyLabels"
                :series="barSeries"
                :height="240"
              />
            </BaseCard>

            <BaseCard fill title="Acompanhamento mensal" description="Entradas e saídas nos últimos 6 meses">
              <BaseSkeleton v-if="initialLoading" height="h-64 md:h-full" />
              <StatisticsChart
                v-else
                fill
                type="line"
                :labels="historyLabels"
                :series="historySeries"
                :height="240"
              />
            </BaseCard>
          </div>

          <div class="grid grid-cols-1 gap-4 md:min-h-0 md:grid-cols-3">
            <BaseCard fill title="Gastos por categoria" :description="formatPeriod(periodStore.period)">
              <template #actions>
                <ExpenseSourceToggle
                  v-model="categorySource"
                  label="Dados do gráfico de gastos por categoria"
                  data-testid="expense-source-by-category"
                />
              </template>

              <BaseSkeleton v-if="initialLoading" height="h-64 md:h-full" />
              <EmptyState
                compact
                v-else-if="!spending.length && categorySource === 'cards'"
                title="Sem gastos no cartão"
                description="Nenhuma fatura de cartão vence neste mês."
              />
              <EmptyState
                compact
                v-else-if="!spending.length"
                title="Sem gastos no período"
                description="Nenhuma saída registrada para este mês."
              />
              <StatisticsChart
                v-else
                fill
                type="doughnut"
                :labels="spendingLabels"
                :series="spendingSeries"
                :colors="spendingColors"
                :height="240"
              />
            </BaseCard>

            <BaseCard fill title="Gastos por tipo" :description="formatPeriod(periodStore.period)">
              <template #actions>
                <ExpenseSourceToggle
                  v-model="typeSource"
                  label="Dados do gráfico de gastos por tipo"
                  data-testid="expense-source-by-type"
                />
              </template>

              <BaseSkeleton v-if="initialLoading" height="h-64 md:h-full" />
              <EmptyState
                compact
                v-else-if="!types.length && typeSource === 'cards'"
                title="Sem gastos no cartão"
                description="Nenhuma fatura de cartão vence neste mês."
              />
              <EmptyState
                compact
                v-else-if="!types.length"
                title="Sem gastos no período"
                description="Nenhuma saída registrada para este mês."
              />
              <StatisticsChart
                v-else
                fill
                type="doughnut"
                :labels="typeLabels"
                :series="typeSeries"
                :colors="typeColors"
                :height="240"
              />
            </BaseCard>

            <BaseCard fill title="Entradas por categoria" :description="formatPeriod(periodStore.period)">
              <BaseSkeleton v-if="initialLoading" height="h-64 md:h-full" />
              <EmptyState
                compact
                v-else-if="!incomes.length"
                title="Sem entradas no período"
                description="Nenhuma entrada registrada para este mês."
              />
              <StatisticsChart
                v-else
                fill
                type="doughnut"
                :labels="incomeLabels"
                :series="incomeSeries"
                :colors="incomeColors"
                :height="240"
              />
            </BaseCard>
          </div>
        </div>
      </div>

      <div
        :inert="!transactionsOpen"
        :aria-hidden="!transactionsOpen"
        class="shrink-0 overflow-hidden transition-[width,opacity,margin] duration-300 ease-out motion-reduce:transition-none md:min-h-0"
        :class="
          transactionsOpen
            ? 'w-full opacity-100 md:ml-6 md:w-80 lg:w-96'
            : 'hidden w-0 opacity-0 md:ml-0 md:block'
        "
      >
        <aside
          id="recent-transactions-panel"
          data-testid="recent-transactions-panel"
          aria-label="Últimas transações"
          class="bg-card border-border flex max-h-[70vh] w-full flex-col rounded-xl border shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none md:h-full md:max-h-none md:w-80 lg:w-96"
          :class="transactionsOpen ? 'translate-x-0' : 'md:translate-x-8'"
        >
          <div class="border-border flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 class="text-base font-semibold">Últimas transações</h2>
              <p class="text-muted-foreground mt-0.5 text-sm">Movimentações mais recentes do período</p>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto">
          <div v-if="initialLoading" class="flex flex-col gap-3 p-5">
            <BaseSkeleton v-for="line in 5" :key="line" height="h-9" />
          </div>

          <EmptyState
            v-else-if="!summary?.recentTransactions.length"
            title="Nenhuma movimentação"
            description="Adicione entradas ou saídas para ver o histórico aqui."
          />

          <ul v-else class="divide-border divide-y">
            <li
              v-for="transaction in summary.recentTransactions"
              :key="`${transaction.movement}-${transaction.id}`"
              class="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-full"
                  :class="
                    transaction.movement === 'ENTRADA'
                      ? 'bg-success-soft text-success'
                      : 'bg-danger-soft text-danger'
                  "
                >
                  <ArrowUpCircle
                    v-if="transaction.movement === 'ENTRADA'"
                    class="size-4"
                    aria-hidden="true"
                  />
                  <ArrowDownCircle v-else class="size-4" aria-hidden="true" />
                </span>

                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ transaction.description }}</p>
                  <div class="mt-0.5 flex items-center gap-2">
                    <BaseBadge :color="transaction.categoryColor">{{ transaction.categoryName }}</BaseBadge>
                    <span class="text-muted-foreground text-xs">{{ formatDate(transaction.date) }}</span>
                  </div>
                </div>
              </div>

              <p
                class="tabular-number shrink-0 text-sm font-semibold"
                :class="transaction.movement === 'ENTRADA' ? 'text-success' : 'text-danger'"
              >
                {{ transaction.movement === 'ENTRADA' ? '+' : '−' }} {{ formatCurrency(transaction.amount) }}
              </p>
            </li>
          </ul>
          </div>
        </aside>
      </div>
    </div>
  </PageLayout>
  </div>
</template>
