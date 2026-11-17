<script setup lang="ts">
import { Menu } from '@lucide/vue'
import { onMounted } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import NotificationMenu from '@/components/features/NotificationMenu.vue'
import UserMenu from '@/components/features/UserMenu.vue'
import { useNotificationStore } from '@/stores/notificationStore'

const emit = defineEmits<{ openMenu: [] }>()

const notificationStore = useNotificationStore()

// O cabeçalho só existe com sessão aberta: carrega os alertas ao entrar e recarrega a cada abertura do sino.
onMounted(() => notificationStore.load())
</script>

<template>
  <header
    class="bg-background/85 sticky top-0 z-20 lg:static flex h-16 items-center gap-3 px-4 backdrop-blur sm:px-[50px] lg:h-auto lg:items-start lg:pt-[35px] lg:pb-4"
  >
    <BaseButton
      variant="ghost"
      size="icon"
      class="lg:hidden"
      aria-label="Abrir menu"
      aria-controls="main-menu"
      @click="emit('openMenu')"
    >
      <Menu class="size-5" aria-hidden="true" />
    </BaseButton>

    <div class="ml-auto flex items-center gap-2">
      <NotificationMenu
        :notifications="notificationStore.notifications"
        :seen-ids="notificationStore.seenIds"
        :loading="notificationStore.loading"
        :error="notificationStore.error"
        @open="notificationStore.load()"
        @seen="notificationStore.markSeen"
        @retry="notificationStore.load()"
      />
      <UserMenu />
    </div>
  </header>
</template>
