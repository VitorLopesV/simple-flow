<script setup lang="ts">
import { Toaster } from 'vue-sonner'

import { useTheme } from '@/composables/useTheme'

const { tema } = useTheme()
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
    <a
      href="#conteudo-principal"
      class="bg-primary text-primary-foreground sr-only z-50 rounded-lg px-4 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
    >
      Pular para o conteúdo
    </a>

    <main id="conteudo-principal" class="flex min-h-screen items-center justify-center px-4 py-12">
      <RouterView v-slot="{ Component }">
        <Transition
          mode="out-in"
          enter-active-class="transition-opacity duration-150"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-100"
          leave-to-class="opacity-0"
        >
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <Toaster :theme="tema" position="top-right" rich-colors close-button />
  </div>
</template>
