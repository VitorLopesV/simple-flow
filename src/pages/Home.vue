<script setup lang="ts">
import PlanningReminder from '@/components/features/PlanningReminder.vue'
import PageLayout from '@/components/layouts/PageLayout.vue'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
</script>

<template>
  <PageLayout title="Início" description="Bem-vindo ao SimpleFlow">
    <!-- Conteúdo provisório: os módulos ganharão resumos aqui nas próximas issues. -->
    <PlanningReminder>
      <template #actions>
        <RouterLink
          :to="{ name: 'sprint' }"
          class="bg-primary text-primary-foreground focus-visible:outline-ring rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2"
          data-testid="planning-link"
        >
          Planejar a semana
        </RouterLink>
      </template>
    </PlanningReminder>
    <p class="text-muted-foreground text-sm">
      Olá<template v-if="authStore.user">, {{ authStore.user.name }}</template>! Escolha um módulo
      na barra lateral para começar.
    </p>
  </PageLayout>
</template>
