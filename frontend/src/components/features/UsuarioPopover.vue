<script setup lang="ts">
import { LogOut, User } from '@lucide/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import BaseButton from '@/components/common/BaseButton.vue'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

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
      class="border-border !size-[47px] !rounded-full border-2"
      aria-label="Menu de usuário"
      @click="abrirPopover = !abrirPopover"
    >
      <User class="size-6" aria-hidden="true" />
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
