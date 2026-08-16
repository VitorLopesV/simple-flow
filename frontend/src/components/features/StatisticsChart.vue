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

import { useTheme } from '@/composables/useTheme'
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
  }>(),
  { cores: () => [], altura: 260, exibirLegenda: true },
)

const { tema } = useTheme()

// O Chart.js desenha em canvas e não enxerga as CSS vars do tema, então as
// cores de grade/texto são resolvidas aqui a partir do tema atual.
const paleta = computed(() => {
  const escuro = tema.value === 'dark'
  return {
    texto: escuro ? '#cbd5e1' : '#64748b',
    grade: escuro ? 'rgba(148, 163, 184, 0.16)' : 'rgba(100, 116, 139, 0.16)',
    fundoTooltip: escuro ? '#1e293b' : '#ffffff',
    textoTooltip: escuro ? '#f1f5f9' : '#0f172a',
    bordaTooltip: escuro ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.2)',
    bordaFatia: escuro ? '#1e293b' : '#ffffff',
  }
})

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
      borderColor: paleta.value.bordaFatia,
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
    color: paleta.value.texto,
    usePointStyle: true,
    pointStyle: 'circle' as const,
    boxWidth: 8,
    padding: 16,
    font: { size: 12 },
  },
}))

const tooltip = computed(() => ({
  backgroundColor: paleta.value.fundoTooltip,
  titleColor: paleta.value.textoTooltip,
  bodyColor: paleta.value.textoTooltip,
  borderColor: paleta.value.bordaTooltip,
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
      ticks: { color: paleta.value.texto, font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: paleta.value.grade },
      border: { display: false },
      ticks: {
        color: paleta.value.texto,
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
  <div :style="{ height: `${altura}px` }" class="relative w-full">
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
