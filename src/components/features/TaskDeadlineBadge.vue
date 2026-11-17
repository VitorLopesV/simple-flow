<script setup lang="ts">
import { CircleCheck, Clock } from '@lucide/vue'
import { computed } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import type { Task } from '@/types/task'
import { deadlineState, fullPoints, latePoints } from '@/utils/taskCompletion'

const props = defineProps<{ task: Task }>()

const state = computed(() => deadlineState(props.task))
const reduced = computed(() => latePoints(props.task))
const full = computed(() => fullPoints(props.task))
</script>

<template>
  <BaseBadge v-if="state === 'done'" tone="success" data-testid="deadline-done">
    <CircleCheck class="size-3" aria-hidden="true" />
    Concluída<template v-if="full !== null"> · {{ full }} pts</template>
  </BaseBadge>
  <BaseBadge v-else-if="state === 'done-late'" tone="warning" data-testid="deadline-done-late">
    <Clock class="size-3" aria-hidden="true" />
    Concluída com atraso<template v-if="reduced !== null"> · {{ reduced }} pts (20%)</template>
  </BaseBadge>
  <BaseBadge v-else-if="state === 'overdue'" tone="danger" data-testid="deadline-overdue">
    <Clock class="size-3" aria-hidden="true" />
    Atrasada: concluir agora vale 20%<template v-if="reduced !== null && full !== null">
      ({{ reduced }} de {{ full }} pts)</template
    >
  </BaseBadge>
</template>
