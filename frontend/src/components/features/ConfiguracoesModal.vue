<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { useTheme } from '@/composables/useTheme'

const aberto = defineModel<boolean>('aberto', { default: false })

const { tema, definirTema } = useTheme()
</script>

<template>
  <BaseModal
    v-model:aberto="aberto"
    titulo="Configurações"
    descricao="Preferências salvas neste dispositivo."
  >
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium">Modo de exibição</span>
        <div class="grid grid-cols-2 gap-2">
          <BaseButton
            :variante="tema === 'light' ? 'primary' : 'outline'"
            @click="definirTema('light')"
          >
            <Sun class="size-4" aria-hidden="true" />
            Claro
          </BaseButton>
          <BaseButton
            :variante="tema === 'dark' ? 'primary' : 'outline'"
            @click="definirTema('dark')"
          >
            <Moon class="size-4" aria-hidden="true" />
            Escuro
          </BaseButton>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
