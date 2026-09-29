<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Toaster } from 'vue-sonner'

import { useCategoryStore } from '@/stores/categoryStore'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'

const route = useRoute()
const categoryStore = useCategoryStore()

const menuOpen = ref(false)

/** Páginas que cabem na viewport (md+): a coluna assume a altura da tela e o conteúdo se ajusta. */
const noScroll = computed(() => route.meta.noScroll === true)

// As categorias alimentam filtros e formulários de todas as páginas.
onMounted(() => void categoryStore.load())

// Fecha o menu mobile ao navegar.
watch(() => route.fullPath, () => (menuOpen.value = false))
</script>

<template>
  <div class="min-h-full">
    <a
      href="#main-content"
      class="bg-primary text-primary-foreground sr-only z-50 rounded-lg px-4 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
    >
      Pular para o conteúdo
    </a>

    <AppSidebar :open="menuOpen" @close="menuOpen = false" />

    <div
      class="flex min-h-full min-w-0 flex-col lg:pl-(--sidebar-width)"
      :class="noScroll && 'md:h-dvh md:overflow-hidden'"
    >
      <AppHeader @open-menu="menuOpen = true" />

      <main
        id="main-content"
        class="min-w-0 flex-1 px-4 py-6 sm:px-[50px]"
        :class="noScroll && 'md:flex md:min-h-0 md:flex-col md:pb-6'"
      >
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

    <Toaster theme="dark" position="top-right" rich-colors close-button />
  </div>
</template>
