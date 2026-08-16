<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'

withDefaults(
  defineProps<{
    titulo?: string
    mensagem: string
    textoConfirmar?: string
    textoCancelar?: string
    carregando?: boolean
    destrutivo?: boolean
  }>(),
  {
    titulo: 'Confirmar ação',
    textoConfirmar: 'Confirmar',
    textoCancelar: 'Cancelar',
    carregando: false,
    destrutivo: true,
  },
)

const aberto = defineModel<boolean>('aberto', { default: false })
const emit = defineEmits<{ confirmar: []; cancelar: [] }>()

function cancelar(): void {
  aberto.value = false
  emit('cancelar')
}
</script>

<template>
  <BaseModal v-model:aberto="aberto" :titulo="titulo" largura="sm">
    <div class="flex gap-3">
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-full"
        :class="destrutivo ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'"
      >
        <TriangleAlert class="size-5" aria-hidden="true" />
      </div>
      <p class="text-muted-foreground pt-2 text-sm">{{ mensagem }}</p>
    </div>

    <template #rodape>
      <div class="flex justify-end gap-2">
        <BaseButton variante="outline" :desabilitado="carregando" @click="cancelar">
          {{ textoCancelar }}
        </BaseButton>
        <BaseButton
          :variante="destrutivo ? 'danger' : 'primary'"
          :carregando="carregando"
          @click="emit('confirmar')"
        >
          {{ textoConfirmar }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
