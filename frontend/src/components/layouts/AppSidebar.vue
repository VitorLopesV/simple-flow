<script setup lang="ts">
import { X } from '@lucide/vue'

import BaseButton from '@/components/common/BaseButton.vue'
import cardsIcon from '@/img/cards_pane_icon.svg'
import dashboardIcon from '@/img/dashboard_pane_icon.svg'
import inflowIcon from '@/img/financial_inflow_pane_icon.svg'
import outflowIcon from '@/img/financial_outflow_pane_icon.svg'
import simpleFlowLogo from '@/img/simple-flow-logo.svg'
import { iconMaskStyle } from '@/utils/iconMask'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

interface MenuItem {
  route: string
  label: string
  /** URL do SVG; vira máscara para herdar a cor do item (hover e ativo). */
  icon: string
}

const items: MenuItem[] = [
  { route: 'dashboard', label: 'Dashboard', icon: dashboardIcon },
  { route: 'incomes', label: 'Entradas', icon: inflowIcon },
  { route: 'expenses', label: 'Saídas', icon: outflowIcon },
  { route: 'cards', label: 'Cartões', icon: cardsIcon },
]
</script>

<template>
  <!-- Backdrop apenas no mobile, quando o menu está aberto -->
  <div
    v-if="open"
    class="bg-overlay fixed inset-0 z-30 lg:hidden"
    aria-hidden="true"
    @click="emit('close')"
  />

  <aside
    id="main-menu"
    class="bg-card border-border fixed inset-y-0 left-0 z-40 flex w-(--sidebar-width) max-w-[85vw] flex-col border-r transition-transform duration-200 lg:translate-x-0"
    :class="open ? 'translate-x-0' : '-translate-x-full'"
    :aria-hidden="!open ? 'true' : undefined"
  >
    <div class="relative flex justify-center pt-6 pb-[43px]">
      <RouterLink :to="{ name: 'dashboard' }" class="cursor-default" @click="emit('close')">
        <img :src="simpleFlowLogo" alt="SimpleFlow" class="mx-auto -mt-[38px] -mb-[9px] block w-[130px] max-w-full" />
      </RouterLink>

      <BaseButton
        variant="ghost"
        size="icon"
        class="absolute top-3 right-3 lg:hidden"
        aria-label="Fechar menu"
        @click="emit('close')"
      >
        <X class="size-4" aria-hidden="true" />
      </BaseButton>
    </div>

    <nav class="flex flex-1 flex-col space-y-1 px-4 pb-4" aria-label="Navegação principal">
      <RouterLink
        v-for="item in items"
        :key="item.route"
        :to="{ name: item.route }"
        class="text-foreground [&:not(.router-link-active)]:hover:bg-success/25 [&:not(.router-link-active)]:focus-visible:bg-success/25 flex items-center gap-3 rounded-lg px-5 py-3 text-sm font-medium outline-none transition-colors"
        active-class="bg-success"
        @click="emit('close')"
      >
        <span class="inline-block size-8 shrink-0 bg-current" :style="iconMaskStyle(item.icon)" aria-hidden="true" />
        {{ item.label }}
      </RouterLink>
    </nav>

    <div class="p-4">
      <p class="text-muted-foreground text-center text-xs">Versão atual: 0.2.5</p>
    </div>
  </aside>
</template>
