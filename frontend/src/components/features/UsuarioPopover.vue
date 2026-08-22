<script setup lang="ts">
import { LogOut, Moon, Sun, User } from '@lucide/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import BaseButton from '@/components/common/BaseButton.vue'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()
const { tema, definirTema } = useTheme()

const abrirPopover = ref(false)

async function handleDeslogar() {
  authStore.limparSessao()
  toast.success('Deslogado com sucesso')
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="relative">
    <BaseButton
      variante="ghost"
      tamanho="icon"
      aria-label="Menu de usuário"
      @click="abrirPopover = !abrirPopover"
    >
      <User class="size-5" aria-hidden="true" />
    </BaseButton>

    <!-- Popover -->
    <div
      v-if="abrirPopover"
      class="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-background shadow-lg z-50"
      @click.stop
    >
      <!-- Informações do usuário -->
      <div class="border-b border-border px-4 py-3">
        <p class="text-sm font-medium text-foreground">{{ authStore.usuario?.email }}</p>
        <p v-if="authStore.usuario?.nome" class="text-xs text-muted-foreground">
          {{ authStore.usuario.nome }}
        </p>
      </div>

      <!-- Modo de visualização -->
      <div class="border-b border-border px-4 py-3">
        <p class="mb-2 text-xs font-medium text-muted-foreground uppercase">Modo de visualização</p>
        <div class="grid grid-cols-2 gap-2">
          <BaseButton
            :variante="tema === 'light' ? 'primary' : 'outline'"
            tamanho="sm"
            @click="definirTema('light')"
          >
            <Sun class="size-4" aria-hidden="true" />
            <span class="hidden sm:inline">Claro</span>
          </BaseButton>
          <BaseButton
            :variante="tema === 'dark' ? 'primary' : 'outline'"
            tamanho="sm"
            @click="definirTema('dark')"
          >
            <Moon class="size-4" aria-hidden="true" />
            <span class="hidden sm:inline">Escuro</span>
          </BaseButton>
        </div>
      </div>

      <!-- Sair -->
      <div class="px-4 py-2">
        <BaseButton
          variante="outline"
          blocoCompleto
          tamanho="sm"
          @click="handleDeslogar"
        >
          <LogOut class="size-4" aria-hidden="true" />
          Sair
        </BaseButton>
      </div>
    </div>

    <!-- Fundo para fechar o popover -->
    <div
      v-if="abrirPopover"
      class="fixed inset-0 z-40"
      @click="abrirPopover = false"
    />
  </div>
</template>
