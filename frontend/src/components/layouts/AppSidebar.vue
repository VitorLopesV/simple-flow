<script setup lang="ts">
import { ArrowDownCircle, ArrowUpCircle, CreditCard, LayoutDashboard, X } from '@lucide/vue'
import type { Component } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import logoSimpleFlow from '@/img/simple-flow-logo.svg'

defineProps<{ aberto: boolean }>()
const emit = defineEmits<{ fechar: [] }>()

interface ItemMenu {
  rota: string
  rotulo: string
  icone: Component
}

const itens: ItemMenu[] = [
  { rota: 'dashboard', rotulo: 'Dashboard', icone: LayoutDashboard },
  { rota: 'entradas', rotulo: 'Entradas', icone: ArrowUpCircle },
  { rota: 'saidas', rotulo: 'Saídas', icone: ArrowDownCircle },
  { rota: 'cartoes', rotulo: 'Cartões', icone: CreditCard },
]
</script>

<template>
  <!-- Backdrop apenas no mobile, quando o menu está aberto -->
  <div
    v-if="aberto"
    class="bg-overlay fixed inset-0 z-30 lg:hidden"
    aria-hidden="true"
    @click="emit('fechar')"
  />

  <aside
    id="menu-principal"
    class="bg-card border-border fixed inset-y-0 left-0 z-40 flex w-(--sidebar-width) max-w-[85vw] flex-col border-r transition-transform duration-200 lg:translate-x-0"
    :class="aberto ? 'translate-x-0' : '-translate-x-full'"
    :aria-hidden="!aberto ? 'true' : undefined"
  >
    <div class="relative flex justify-center pt-6 pb-[43px]">
      <RouterLink :to="{ name: 'dashboard' }" class="cursor-default" @click="emit('fechar')">
        <img :src="logoSimpleFlow" alt="SimpleFlow" class="mx-auto -mt-[38px] -mb-[9px] block w-[160px] max-w-full" />
      </RouterLink>

      <BaseButton
        variante="ghost"
        tamanho="icon"
        class="absolute top-3 right-3 lg:hidden"
        aria-label="Fechar menu"
        @click="emit('fechar')"
      >
        <X class="size-4" aria-hidden="true" />
      </BaseButton>
    </div>

    <nav class="flex flex-1 flex-col space-y-1 px-4 pb-4" aria-label="Navegação principal">
      <RouterLink
        v-for="item in itens"
        :key="item.rota"
        :to="{ name: item.rota }"
        class="text-muted-foreground [&:not(.router-link-active)]:hover:bg-success/25 [&:not(.router-link-active)]:hover:text-foreground [&:not(.router-link-active)]:focus-visible:bg-success/25 [&:not(.router-link-active)]:focus-visible:text-foreground flex items-center gap-3 rounded-lg px-5 py-3 text-base font-medium outline-none transition-colors"
        active-class="bg-success text-success-foreground"
        @click="emit('fechar')"
      >
        <component :is="item.icone" class="size-5 shrink-0" aria-hidden="true" />
        {{ item.rotulo }}
      </RouterLink>
    </nav>

    <div class="p-4">
      <p class="text-muted-foreground text-center text-xs">Versão atual: 0.2.0</p>
    </div>
  </aside>
</template>
