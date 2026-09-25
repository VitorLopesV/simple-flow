<script setup lang="ts">
import { Menu } from '@lucide/vue'

import BaseButton from '@/components/common/BaseButton.vue'
import MonthPicker from '@/components/features/MonthPicker.vue'
import UsuarioPopover from '@/components/features/UsuarioPopover.vue'
import { usePeriodoStore } from '@/stores/periodoStore'

const emit = defineEmits<{ abrirMenu: [] }>()

const periodoStore = usePeriodoStore()
</script>

<template>
  <header
    class="bg-background/85 sticky top-0 z-20 flex h-16 items-center gap-3 px-4 backdrop-blur sm:px-6"
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

    <div class="ml-auto flex items-center gap-2">
      <MonthPicker
        v-model="periodoStore.periodo"
        class="hidden sm:flex"
        @hoje="periodoStore.irParaHoje()"
      />
      <UsuarioPopover />
    </div>
  </header>
</template>
