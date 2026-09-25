<script setup lang="ts">
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js'
import { computed } from 'vue'
import { Bar, Doughnut, Line } from 'vue-chartjs'

import { formatCurrency, formatCurrencyCompact } from '@/utils/currencyFormatter'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
)

// O canvas não herda a fonte do CSS: define a família global do Chart.js
// (legendas, eixos e tooltips), com o mesmo fallback de `--font-sans`.
ChartJS.defaults.font.family =
  "'Montserrat', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

export interface SerieGrafico {
  nome: string
  dados: number[]
  cor: string
}

const props = withDefaults(
  defineProps<{
    tipo: 'linha' | 'barra' | 'rosca'
    labels: string[]
    /** Em `rosca`, apenas a primeira série é usada — uma fatia por rótulo. */
    series: SerieGrafico[]
    /** Cores das fatias da rosca, na ordem dos rótulos. */
    cores?: string[]
    /** Altura em pixels; a largura sempre acompanha o container. */
    altura?: number
    exibirLegenda?: boolean
    /** Em `md`+ ignora `altura` e ocupa 100% do pai (que precisa ter altura definida). */
    preencher?: boolean
  }>(),
  { cores: () => [], altura: 260, exibirLegenda: true, preencher: false },
)

// O Chart.js desenha em canvas e não enxerga as CSS vars do tema, então as
// cores de grade/texto ficam aqui, alinhadas ao tema escuro.
const paleta = {
  texto: '#cbd5e1',
  grade: 'rgba(148, 163, 184, 0.16)',
  fundoTooltip: '#1e293b',
  textoTooltip: '#f1f5f9',
  bordaTooltip: 'rgba(148,163,184,0.35)',
  bordaFatia: '#1e293b',
}

const dadosCartesianos = computed<ChartData<'line' | 'bar'>>(() => ({
  labels: props.labels,
  datasets: props.series.map((serie) => ({
    label: serie.nome,
    data: serie.dados,
    borderColor: serie.cor,
    backgroundColor: props.tipo === 'linha' ? `${serie.cor}22` : serie.cor,
    borderWidth: props.tipo === 'linha' ? 2 : 0,
    borderRadius: props.tipo === 'barra' ? 6 : 0,
    tension: 0.35,
    fill: props.tipo === 'linha',
    pointRadius: 3,
    pointHoverRadius: 5,
    pointBackgroundColor: serie.cor,
    maxBarThickness: 38,
  })),
}))

const dadosRosca = computed<ChartData<'doughnut'>>(() => ({
  labels: props.labels,
  datasets: [
    {
      label: props.series[0]?.nome ?? '',
      data: props.series[0]?.dados ?? [],
      backgroundColor: props.cores.length ? props.cores : [props.series[0]?.cor ?? '#94a3b8'],
      borderColor: paleta.bordaFatia,
      borderWidth: 2,
      hoverOffset: 6,
    },
  ],
}))

function rotuloTooltip(contexto: TooltipItem<'line' | 'bar' | 'doughnut'>): string {
  // Séries cartesianas trazem `{ x, y }`; a rosca traz o número direto.
  const parsed = contexto.parsed as number | { y: number | null }
  const valor = typeof parsed === 'number' ? parsed : Number(parsed?.y ?? 0)
  const nome = contexto.dataset?.label || contexto.label || ''
  return ` ${nome}: ${formatCurrency(valor)}`
}

const legenda = computed(() => ({
  display: props.exibirLegenda,
  position: (props.tipo === 'rosca' ? 'right' : 'top') as 'right' | 'top',
  align: 'end' as const,
  labels: {
    color: paleta.texto,
    usePointStyle: true,
    pointStyle: 'circle' as const,
    boxWidth: 8,
    padding: props.preencher ? 10 : 16,
    font: { size: props.preencher ? 11 : 12 },
  },
}))

const tooltip = computed(() => ({
  backgroundColor: paleta.fundoTooltip,
  titleColor: paleta.textoTooltip,
  bodyColor: paleta.textoTooltip,
  borderColor: paleta.bordaTooltip,
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
  usePointStyle: true,
  callbacks: { label: rotuloTooltip },
}))

const opcoesCartesianas = computed<ChartOptions<'line' | 'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: legenda.value, tooltip: tooltip.value },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: paleta.texto, font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: paleta.grade },
      border: { display: false },
      ticks: {
        color: paleta.texto,
        font: { size: 11 },
        callback: (valor: string | number) => formatCurrencyCompact(Number(valor)),
      },
    },
  },
}))

const opcoesRosca = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: { legend: legenda.value, tooltip: tooltip.value },
}))
</script>

<template>
  <div
    :style="{ '--altura-grafico': `${altura}px` }"
    class="relative h-(--altura-grafico) w-full min-w-0"
    :class="preencher && 'md:h-full'"
  >
    <Line
      v-if="tipo === 'linha'"
      :data="(dadosCartesianos as ChartData<'line'>)"
      :options="(opcoesCartesianas as ChartOptions<'line'>)"
    />
    <Bar
      v-else-if="tipo === 'barra'"
      :data="(dadosCartesianos as ChartData<'bar'>)"
      :options="(opcoesCartesianas as ChartOptions<'bar'>)"
    />
    <Doughnut v-else :data="dadosRosca" :options="opcoesRosca" />
  </div>
</template>
