<script setup lang="ts">
import { Gift, Settings2 } from '@lucide/vue'
import { ref } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import RewardForm from '@/components/features/RewardForm.vue'

defineProps<{
  /** Recompensa própria do sprint (`null` = usa a padrão). */
  reward: string | null
  defaultReward: string | null
  /** A que vale: a do sprint, senão a padrão. */
  effectiveReward: string | null
  /** Sprint fechado: só leitura. */
  closed?: boolean
  saving?: boolean
}>()

const emit = defineEmits<{ saveReward: [reward: string | null]; saveDefault: [reward: string | null] }>()

const defaultOpen = ref(false)

function saveDefault(reward: string | null): void {
  emit('saveDefault', reward)
  defaultOpen.value = false
}
</script>

<template>
  <section class="bg-card border-border rounded-card flex flex-col gap-3 border p-4" aria-label="Recompensa do sprint">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 text-sm font-semibold">
        <Gift class="text-primary size-4" aria-hidden="true" />
        Recompensa do sprint
      </h2>
      <BaseButton variant="ghost" size="sm" data-testid="open-default-reward" @click="defaultOpen = true">
        <Settings2 class="size-4" aria-hidden="true" />
        Recompensa padrão
      </BaseButton>
    </div>

    <p class="text-sm" data-testid="reward-current">
      <template v-if="effectiveReward">
        {{ effectiveReward }}
        <span v-if="!reward && !closed" class="text-muted-foreground">(recompensa padrão)</span>
      </template>
      <span v-else class="text-muted-foreground">Nenhuma recompensa definida.</span>
    </p>

    <RewardForm
      v-if="!closed"
      :model-value="reward"
      label="Recompensa deste sprint"
      :hint="defaultReward ? `Vazio usa a padrão: ${defaultReward}` : undefined"
      :saving="saving"
      submit-label="Salvar recompensa"
      @save="emit('saveReward', $event)"
    />
    <p v-else class="text-muted-foreground text-xs">Sprint encerrado: a recompensa não pode mais ser alterada.</p>

    <BaseModal
      v-model:open="defaultOpen"
      title="Recompensa padrão"
      description="Vale para os sprints em que você não definir uma recompensa própria."
    >
      <RewardForm
        :model-value="defaultReward"
        label="Recompensa padrão"
        :saving="saving"
        submit-label="Salvar padrão"
        @save="saveDefault"
      />
    </BaseModal>
  </section>
</template>
