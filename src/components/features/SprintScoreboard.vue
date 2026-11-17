<script setup lang="ts">
import { Trophy } from '@lucide/vue'
import { computed } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import type { Scoreboard } from '@/types/sprint'

const props = defineProps<{ scoreboard: Scoreboard; preview?: boolean }>()

const percentage = computed(
  () => `${props.scoreboard.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`,
)
/** A largura é só visual (0–100); o selo de bônus vem sempre de `bonus`, não do percentual arredondado. */
const barWidth = computed(() => `${Math.min(100, Math.max(0, props.scoreboard.percentage))}%`)
</script>

<template>
  <section class="bg-card border-border rounded-card flex flex-col gap-3 border p-4" aria-label="Placar do sprint">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p class="text-2xl font-semibold tabular-nums" data-testid="scoreboard-points">
        {{ scoreboard.done }}
        <span class="text-muted-foreground text-base font-normal">/ {{ scoreboard.total }} pts</span>
      </p>
      <span class="text-muted-foreground text-sm tabular-nums" data-testid="scoreboard-percentage">{{ percentage }}</span>
      <BaseBadge v-if="scoreboard.bonus" tone="success" data-testid="bonus-badge">
        <Trophy class="size-3.5" aria-hidden="true" />
        Bônus conquistado
      </BaseBadge>
      <BaseBadge v-if="preview" tone="info">Planejamento: o sprint ainda não começou</BaseBadge>
    </div>

    <!-- A marca em 90% é a faixa do bônus (o selo vem de `bonus`, não desta posição). -->
    <div class="relative">
      <div
        class="bg-muted h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Pontos feitos do total"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="scoreboard.percentage"
        :aria-valuetext="`${scoreboard.done} de ${scoreboard.total} pontos`"
      >
        <div
          class="h-full rounded-full transition-[width] motion-reduce:transition-none"
          :class="scoreboard.bonus ? 'bg-success' : 'bg-primary'"
          :style="{ width: barWidth }"
        />
      </div>
      <span
        class="bg-foreground/60 absolute -top-0.5 left-[90%] h-3 w-px"
        aria-hidden="true"
        data-testid="bonus-threshold"
      />
    </div>

    <dl class="text-muted-foreground grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
      <div class="flex gap-1">
        <dt>Rotina:</dt>
        <dd data-testid="scoreboard-routine">
          {{ scoreboard.routine.daysCompleted }} de {{ scoreboard.routine.daysWithRoutine }} dias ·
          {{ scoreboard.routine.done }}/{{ scoreboard.routine.total }} pts
        </dd>
      </div>
      <div class="flex gap-1">
        <dt>Tarefas:</dt>
        <dd data-testid="scoreboard-tasks">
          {{ scoreboard.tasks.completed }} de {{ scoreboard.tasks.count }} ·
          {{ scoreboard.tasks.done }}/{{ scoreboard.tasks.total }} pts
        </dd>
      </div>
    </dl>
  </section>
</template>
