<script setup lang="ts">
import { Menu } from '@lucide/vue'
import { useRoute } from 'vue-router'

import BaseButton from '@/components/common/BaseButton.vue'
import MonthPicker from '@/components/features/MonthPicker.vue'
import { usePeriodoStore } from '@/stores/periodoStore'

const emit = defineEmits<{ abrirMenu: [] }>()

const route = useRoute()
const periodoStore = usePeriodoStore()
</script>

<template>
  <header
    class="bg-background/85 border-border sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-6"
  >
    <BaseButton
      variante="ghost"
      tamanho="icon"
      class="lg:hidden"
      aria-label="Abrir menu"
      aria-controls="menu-principal"
      @click="emit('abrirMenu')"
    >
      <Menu class="size-5" aria-hidden="true" />
    </BaseButton>

    <h1 class="truncate text-base font-semibold sm:text-lg">
      {{ route.meta.titulo ?? 'Controle Financeiro' }}
    </h1>

    <div class="ml-auto flex items-center gap-2">
      <MonthPicker
        v-model="periodoStore.periodo"
        class="hidden sm:flex"
        @hoje="periodoStore.irParaHoje()"
      />
    </div>
  </header>
</template>
