<script setup lang="ts">
import { useAuthStore } from '@/stores/authStore'
import PageLayout from '@/components/layouts/PageLayout.vue'

const authStore = useAuthStore()
</script>

<template>
  <PageLayout title="Início" description="Bem-vindo ao SimpleFlow">
    <!-- Conteúdo provisório: os módulos ganharão resumos aqui nas próximas issues. -->
    <p class="text-muted-foreground text-sm">
      Olá<template v-if="authStore.user">, {{ authStore.user.name }}</template>! Escolha um módulo
      na barra lateral para começar.
    </p>
  </PageLayout>
</template>
