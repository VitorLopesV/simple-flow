<script setup lang="ts">
import { Menu } from '@lucide/vue'

import BaseButton from '@/components/common/BaseButton.vue'
import UsuarioPopover from '@/components/features/UsuarioPopover.vue'

const emit = defineEmits<{ abrirMenu: [] }>()
</script>

<template>
  <header
    class="bg-background/85 sticky top-0 z-20 lg:static flex h-16 items-center gap-3 px-4 backdrop-blur sm:px-[50px] lg:h-auto lg:items-start lg:pt-[35px] lg:pb-4"
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
      <UsuarioPopover />
    </div>
  </header>
</template>
