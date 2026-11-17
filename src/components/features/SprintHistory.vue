<script setup lang="ts">
import { History } from '@lucide/vue'
import { onMounted, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BasePagination from '@/components/common/BasePagination.vue'
import BaseSkeleton from '@/components/common/BaseSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SprintHistoryItem from '@/components/features/SprintHistoryItem.vue'
import { notify } from '@/composables/useNotify'
import { useSprintHistoryStore } from '@/stores/sprintHistoryStore'

const store = useSprintHistoryStore()

onMounted(() => store.load(1))

watch(
  () => store.error,
  (error) => error && notify.error(error),
)
</script>

<template>
  <section class="flex flex-col gap-3" aria-label="Histórico de sprints" :aria-busy="store.loading">
    <div
      v-if="!store.loaded && !store.error"
      class="bg-card border-border rounded-card border p-4"
      data-testid="history-loading"
    >
      <BaseSkeleton :lines="3" height="h-6" />
    </div>

    <div
      v-else-if="store.error && store.items.length === 0"
      class="bg-card border-border rounded-card flex flex-wrap items-center gap-3 border p-4 text-sm"
      role="alert"
      data-testid="history-error"
    >
      <p class="min-w-0 flex-1">{{ store.error }}</p>
      <BaseButton size="sm" variant="outline" @click="store.load(store.page)">Tentar novamente</BaseButton>
    </div>

    <EmptyState
      v-else-if="store.isEmpty"
      title="Nenhum sprint fechado ainda"
      description="Quando a primeira semana terminar, o resultado dela aparece aqui."
      class="bg-card border-border rounded-card border"
      data-testid="history-empty"
    >
      <template #icon><History class="size-6" aria-hidden="true" /></template>
    </EmptyState>

    <template v-else>
      <div class="flex flex-col gap-3" :class="store.loading ? 'opacity-60' : ''">
        <SprintHistoryItem v-for="entry in store.items" :key="entry.sprintId" :entry="entry" />
      </div>
      <BasePagination
        :page="store.page"
        :total-pages="store.totalPages"
        :total="store.total"
        :page-size="store.pageSize"
        @change="store.goTo"
      />
    </template>
  </section>
</template>
