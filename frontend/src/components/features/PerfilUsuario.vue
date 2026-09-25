<script setup lang="ts">
import { LogOut, UserRound } from '@lucide/vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/common/BaseButton.vue'
import PerfilModal from '@/components/features/PerfilModal.vue'
import UsuarioAvatar from '@/components/features/UsuarioAvatar.vue'
import { notificar } from '@/composables/useNotify'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const menuAberto = ref(false)
const perfilAberto = ref(false)

function fecharComEsc(evento: KeyboardEvent): void {
  if (evento.key === 'Escape') menuAberto.value = false
}

// O Esc só é escutado enquanto o menu está aberto (o modal de perfil trata o próprio Esc).
watch(menuAberto, (aberto) => {
  if (aberto) window.addEventListener('keydown', fecharComEsc)
  else window.removeEventListener('keydown', fecharComEsc)
})
onBeforeUnmount(() => window.removeEventListener('keydown', fecharComEsc))

function abrirPerfil(): void {
  menuAberto.value = false
  perfilAberto.value = true
}

async function sair(): Promise<void> {
  menuAberto.value = false
  authStore.limparSessao()
  notificar.sucesso('Deslogado com sucesso')
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="relative">
    <BaseButton
      variante="ghost"
      tamanho="icon"
      class="border-border !size-[47px] !rounded-full border-2 !p-0"
      aria-label="Menu de usuário"
      aria-haspopup="menu"
      :aria-expanded="menuAberto"
      @click="menuAberto = !menuAberto"
    >
      <UsuarioAvatar :foto-url="authStore.usuario?.fotoUrl" class="size-full" />
    </BaseButton>

    <div
      v-if="menuAberto"
      role="menu"
      aria-label="Menu de usuário"
      class="border-border bg-background absolute top-full right-0 z-50 mt-2 w-56 rounded-lg border shadow-lg"
    >
      <div class="border-border border-b px-4 py-3">
        <p class="text-foreground truncate text-sm font-medium">{{ authStore.usuario?.email }}</p>
        <p v-if="authStore.usuario?.nome" class="text-muted-foreground truncate text-xs">
          {{ authStore.usuario.nome }}
        </p>
      </div>

      <div class="flex flex-col gap-2 px-4 py-3">
        <BaseButton variante="outline" tamanho="sm" bloco-completo role="menuitem" @click="abrirPerfil">
          <UserRound class="size-4" aria-hidden="true" />
          Meu perfil
        </BaseButton>
        <BaseButton
          variante="outline"
          tamanho="sm"
          bloco-completo
          role="menuitem"
          class="!text-danger hover:!bg-danger/25"
          @click="sair"
        >
          <LogOut class="size-4" aria-hidden="true" />
          Sair
        </BaseButton>
      </div>
    </div>

    <!-- Fundo para fechar o menu ao clicar fora -->
    <div
      v-if="menuAberto"
      class="fixed inset-0 z-40"
      data-testid="fundo-menu"
      aria-hidden="true"
      @click="menuAberto = false"
    />

    <PerfilModal v-model:aberto="perfilAberto" />
  </div>
</template>
