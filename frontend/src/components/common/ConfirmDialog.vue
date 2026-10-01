<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'

withDefaults(
  defineProps<{
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    loading?: boolean
    destructive?: boolean
  }>(),
  {
    title: 'Confirmar ação',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    loading: false,
    destructive: true,
  },
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: []; cancel: [] }>()

function cancel(): void {
  open.value = false
  emit('cancel')
}
</script>

<template>
  <BaseModal v-model:open="open" :title="title" width="sm">
    <div class="flex gap-3">
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-full"
        :class="destructive ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'"
      >
        <TriangleAlert class="size-5" aria-hidden="true" />
      </div>
      <div class="flex flex-col gap-3 pt-2 text-sm">
        <p class="text-muted-foreground">{{ message }}</p>
        <!-- Conteúdo extra opcional abaixo da mensagem (ex.: lista de itens afetados). -->
        <slot />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <BaseButton variant="outline" :disabled="loading" @click="cancel">
          {{ cancelText }}
        </BaseButton>
        <BaseButton
          :variant="destructive ? 'danger' : 'primary'"
          :loading="loading"
          @click="emit('confirm')"
        >
          {{ confirmText }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
