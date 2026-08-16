<script setup lang="ts">
import { Compass } from '@lucide/vue'

import BaseButton from '@/components/common/BaseButton.vue'
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
    <span class="bg-muted text-muted-foreground rounded-full p-4">
      <Compass class="size-8" aria-hidden="true" />
    </span>
    <div>
      <p class="text-muted-foreground text-sm font-medium">Erro 404</p>
      <h1 class="mt-1 text-2xl font-semibold">Página não encontrada</h1>
      <p class="text-muted-foreground mt-2 max-w-md text-sm">
        O endereço acessado não existe ou foi movido. Volte para o painel para continuar.
      </p>
    </div>
    <BaseButton @click="$router.push({ name: 'dashboard' })">
      Ir para o Dashboard
    </BaseButton>
  </main>
</template>
