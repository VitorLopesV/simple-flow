<script setup lang="ts">
import { CreditCard, TrendingUp, Wallet } from '@lucide/vue'
import { Toaster } from 'vue-sonner'

import AuthBrand from '@/components/features/AuthBrand.vue'


const HIGHLIGHTS = [
  { icon: Wallet, text: 'Saiba quanto sobra do seu mês, sem planilhas' },
  { icon: TrendingUp, text: 'Acompanhe entradas e saídas mês a mês' },
  { icon: CreditCard, text: 'Faturas de cartão separadas dos demais gastos' },
]
</script>

<template>
  <div class="bg-background min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <a
      href="#main-content"
      class="bg-primary text-primary-foreground sr-only z-50 rounded-lg px-4 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
    >
      Pular para o conteúdo
    </a>

    <!-- Painel da marca: só em telas grandes; no mobile a marca aparece acima do formulário. -->
    <aside
      class="from-success/20 via-success/5 to-background relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br p-12 lg:flex"
    >
      <div
        class="bg-success/20 pointer-events-none absolute -top-24 -right-24 size-96 rounded-full blur-3xl"
        aria-hidden="true"
      />
      <div
        class="bg-success/15 pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full blur-3xl"
        aria-hidden="true"
      />

      <div class="relative">
        <AuthBrand align="start" />
      </div>

      <div class="relative max-w-md">
        <h2 class="text-foreground text-4xl font-light tracking-tight">
          Suas finanças, <span class="text-success font-semibold">simples</span> e no fluxo certo.
        </h2>

        <ul class="mt-8 space-y-4">
          <li v-for="highlight in HIGHLIGHTS" :key="highlight.text" class="flex items-center gap-3">
            <span class="bg-success/15 text-success flex size-10 shrink-0 items-center justify-center rounded-lg">
              <component :is="highlight.icon" class="size-5" aria-hidden="true" />
            </span>
            <span class="text-foreground/80 text-base">{{ highlight.text }}</span>
          </li>
        </ul>
      </div>

      <p class="text-muted-foreground relative text-sm">SimpleFlow · Controle financeiro pessoal</p>
    </aside>

    <main id="main-content" class="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
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

    <Toaster theme="dark" position="top-right" rich-colors close-button />
  </div>
</template>
