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

export interface ChartSeries {
  name: string
  data: number[]
  color: string
}

const props = withDefaults(
  defineProps<{
    type: 'line' | 'bar' | 'doughnut'
    labels: string[]
    /** Em `doughnut`, apenas a primeira série é usada — uma fatia por rótulo. */
    series: ChartSeries[]
    /** Cores das fatias da rosca, na ordem dos rótulos. */
    colors?: string[]
    /** Altura em pixels; a largura sempre acompanha o container. */
    height?: number
    showLegend?: boolean
    /** Em `md`+ ignora `height` e ocupa 100% do pai (que precisa ter altura definida). */
    fill?: boolean
  }>(),
  { colors: () => [], height: 260, showLegend: true, fill: false },
)

// O Chart.js desenha em canvas e não enxerga as CSS vars do tema, então as
// cores de grade/texto ficam aqui, alinhadas ao tema escuro.
const palette = {
  text: '#cbd5e1',
  grid: 'rgba(148, 163, 184, 0.16)',
  tooltipBackground: '#1e293b',
  tooltipText: '#f1f5f9',
  tooltipBorder: 'rgba(148,163,184,0.35)',
  sliceBorder: '#1e293b',
}

const cartesianData = computed<ChartData<'line' | 'bar'>>(() => ({
  labels: props.labels,
  datasets: props.series.map((series) => ({
    label: series.name,
    data: series.data,
    borderColor: series.color,
    backgroundColor: props.type === 'line' ? `${series.color}22` : series.color,
    borderWidth: props.type === 'line' ? 2 : 0,
    borderRadius: props.type === 'bar' ? 6 : 0,
    tension: 0.35,
    fill: props.type === 'line',
    pointRadius: 3,
    pointHoverRadius: 5,
    pointBackgroundColor: series.color,
    maxBarThickness: 38,
  })),
}))

const doughnutData = computed<ChartData<'doughnut'>>(() => ({
  labels: props.labels,
  datasets: [
    {
      label: props.series[0]?.name ?? '',
      data: props.series[0]?.data ?? [],
      backgroundColor: props.colors.length ? props.colors : [props.series[0]?.color ?? '#94a3b8'],
      borderColor: palette.sliceBorder,
      borderWidth: 2,
      hoverOffset: 6,
    },
  ],
}))

function tooltipLabel(context: TooltipItem<'line' | 'bar' | 'doughnut'>): string {
  // Séries cartesianas trazem `{ x, y }`; a rosca traz o número direto.
  const parsed = context.parsed as number | { y: number | null }
  const value = typeof parsed === 'number' ? parsed : Number(parsed?.y ?? 0)
  const name = context.dataset?.label || context.label || ''
  return ` ${name}: ${formatCurrency(value)}`
}

const legend = computed(() => ({
  display: props.showLegend,
  position: (props.type === 'doughnut' ? 'right' : 'top') as 'right' | 'top',
  align: 'end' as const,
  labels: {
    color: palette.text,
    usePointStyle: true,
    pointStyle: 'circle' as const,
    boxWidth: 8,
    padding: props.fill ? 10 : 16,
    font: { size: props.fill ? 11 : 12 },
  },
}))

const tooltip = computed(() => ({
  backgroundColor: palette.tooltipBackground,
  titleColor: palette.tooltipText,
  bodyColor: palette.tooltipText,
  borderColor: palette.tooltipBorder,
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
  usePointStyle: true,
  callbacks: { label: tooltipLabel },
}))

const cartesianOptions = computed<ChartOptions<'line' | 'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: legend.value, tooltip: tooltip.value },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: palette.text, font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: palette.grid },
      border: { display: false },
      ticks: {
        color: palette.text,
        font: { size: 11 },
        callback: (value: string | number) => formatCurrencyCompact(Number(value)),
      },
    },
  },
}))

const doughnutOptions = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: { legend: legend.value, tooltip: tooltip.value },
}))
</script>

<template>
  <div
    :style="{ '--chart-height': `${height}px` }"
    class="relative h-(--chart-height) w-full min-w-0"
    :class="fill && 'md:h-full'"
  >
    <Line
      v-if="type === 'line'"
      :data="(cartesianData as ChartData<'line'>)"
      :options="(cartesianOptions as ChartOptions<'line'>)"
    />
    <Bar
      v-else-if="type === 'bar'"
      :data="(cartesianData as ChartData<'bar'>)"
      :options="(cartesianOptions as ChartOptions<'bar'>)"
    />
    <Doughnut v-else :data="doughnutData" :options="doughnutOptions" />
  </div>
</template>
