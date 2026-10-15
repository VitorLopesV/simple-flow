<script setup lang="ts">
import { LogOut, UserRound } from '@lucide/vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/common/BaseButton.vue'
import ProfileModal from '@/components/features/ProfileModal.vue'
import UserAvatar from '@/components/features/UserAvatar.vue'
import { notify } from '@/composables/useNotify'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const menuOpen = ref(false)
const profileOpen = ref(false)

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') menuOpen.value = false
}

// O Esc só é escutado enquanto o menu está aberto (o modal de perfil trata o próprio Esc).
watch(menuOpen, (open) => {
  if (open) window.addEventListener('keydown', closeOnEscape)
  else window.removeEventListener('keydown', closeOnEscape)
})
onBeforeUnmount(() => window.removeEventListener('keydown', closeOnEscape))

/** Tab para fora do menu (ex.: até o sino de notificações) fecha, então os dois nunca se sobrepõem. */
function closeOnFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget as Node | null
  if (next && !(event.currentTarget as HTMLElement).contains(next)) menuOpen.value = false
}

function openProfile(): void {
  menuOpen.value = false
  profileOpen.value = true
}

async function logOut(): Promise<void> {
  menuOpen.value = false
  authStore.clearSession()
  notify.success('Deslogado com sucesso')
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="relative flex" @focusout="closeOnFocusOut">
    <BaseButton
      variant="ghost"
      size="icon"
      class="border-border !size-[56px] !rounded-full border-2 !p-0"
      aria-label="Menu de usuário"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      @click="menuOpen = !menuOpen"
    >
      <UserAvatar :photo-url="authStore.user?.photoUrl" class="size-full" />
    </BaseButton>

    <div
      v-if="menuOpen"
      role="menu"
      aria-label="Menu de usuário"
      class="border-border bg-background absolute top-full right-0 z-50 mt-2 w-56 rounded-lg border shadow-lg"
    >
      <div class="border-border border-b px-4 py-3">
        <p class="text-foreground truncate text-sm font-medium">{{ authStore.user?.email }}</p>
        <p v-if="authStore.user?.name" class="text-muted-foreground truncate text-xs">
          {{ authStore.user.name }}
        </p>
      </div>

      <div class="flex flex-col gap-2 px-4 py-3">
        <BaseButton variant="outline" size="sm" full-width role="menuitem" @click="openProfile">
          <UserRound class="size-4" aria-hidden="true" />
          Meu perfil
        </BaseButton>
        <BaseButton
          variant="outline"
          size="sm"
          full-width
          role="menuitem"
          class="!text-danger hover:!bg-danger/25"
          @click="logOut"
        >
          <LogOut class="size-4" aria-hidden="true" />
          Sair
        </BaseButton>
      </div>
    </div>

    <!-- Fundo para fechar o menu ao clicar fora -->
    <div
      v-if="menuOpen"
      class="fixed inset-0 z-40"
      data-testid="menu-backdrop"
      aria-hidden="true"
      @click="menuOpen = false"
    />

    <ProfileModal v-model:open="profileOpen" />
  </div>
</template>
