<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Toaster } from 'vue-sonner'

import { useTheme } from '@/composables/useTheme'
import { useCategoriaStore } from '@/stores/categoriaStore'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'

const route = useRoute()
const categoriaStore = useCategoriaStore()
const { tema } = useTheme()

const menuAberto = ref(false)

// As categorias alimentam filtros e formulários de todas as páginas.
onMounted(() => void categoriaStore.carregar())

// Fecha o menu mobile ao navegar.
watch(() => route.fullPath, () => (menuAberto.value = false))
</script>

<template>
  <div class="min-h-full">
    <a
      href="#conteudo-principal"
      class="bg-primary text-primary-foreground sr-only z-50 rounded-lg px-4 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
    >
      Pular para o conteúdo
    </a>

    <AppSidebar :aberto="menuAberto" @fechar="menuAberto = false" />

    <div class="flex min-h-full flex-col lg:pl-64">
      <AppHeader @abrir-menu="menuAberto = true" />

      <main id="conteudo-principal" class="flex-1 px-4 py-6 sm:px-6 lg:px-8">
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
    </div>

    <Toaster :theme="tema" position="top-right" rich-colors close-button />
  </div>
</template>
