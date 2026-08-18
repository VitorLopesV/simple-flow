<script setup lang="ts">
import { ArrowDownCircle, ArrowUpCircle, CreditCard, LayoutDashboard, Settings, X } from '@lucide/vue'
import type { Component } from 'vue'
import { ref } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import ConfiguracoesModal from '@/components/features/ConfiguracoesModal.vue'
import logoSimpleFlow from '@/img/simple-flow-logo.png'

defineProps<{ aberto: boolean }>()
const emit = defineEmits<{ fechar: [] }>()

const configAberto = ref(false)

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
    class="bg-card border-border fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r transition-transform duration-200 lg:translate-x-0"
    :class="aberto ? 'translate-x-0' : '-translate-x-full'"
    :aria-hidden="!aberto ? 'true' : undefined"
  >
    <div class="border-border relative flex h-28 items-center justify-center border-b">
      <RouterLink :to="{ name: 'dashboard' }" @click="emit('fechar')">
        <img :src="logoSimpleFlow" alt="SimpleFlow" class="mx-auto w-[160px]" />
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

    <nav class="flex flex-1 flex-col space-y-1 p-3" aria-label="Navegação principal">
      <RouterLink
        v-for="item in itens"
        :key="item.rota"
        :to="{ name: item.rota }"
        class="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        @click="emit('fechar')"
      >
        <component :is="item.icone" class="size-4 shrink-0" aria-hidden="true" />
        {{ item.rotulo }}
      </RouterLink>

      <BaseButton
        variante="ghost"
        class="text-muted-foreground hover:bg-muted hover:text-foreground mt-auto w-full justify-start gap-3 px-3 py-2 text-sm font-medium"
        @click="configAberto = true"
      >
        <Settings class="size-4 shrink-0" aria-hidden="true" />
        Configurações
      </BaseButton>
    </nav>

    <div class="border-border border-t p-3">
      <p class="text-muted-foreground text-center text-xs">Versão atual: 0.1.0</p>
    </div>
  </aside>

  <ConfiguracoesModal v-model:aberto="configAberto" />
</template>
