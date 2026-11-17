<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import type { SuperTask, SuperTaskChildrenDestination } from '@/types/superTask'
import { SUPER_TASK_REASON } from '@/types/superTask'

const props = withDefaults(defineProps<{ superTask: SuperTask | null; loading?: boolean }>(), { loading: false })

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [children: SuperTaskChildrenDestination] }>()

const choice = ref<SuperTaskChildrenDestination>('release')

const children = computed(() => props.superTask?.tasks ?? [])
/** Filha no sprint aberto bloqueia a exclusão nos dois modos. */
const blockedBySprint = computed(() => children.value.some((task) => task.sprintId && !task.done))
/** "Excluir junto" não vale com filha concluída: ela precisa ser mantida (pontos já ganhos). */
const deleteTogetherBlocked = computed(() => children.value.some((task) => task.done))
const confirmDisabled = computed(
  () => blockedBySprint.value || (choice.value === 'delete' && deleteTogetherBlocked.value),
)

watch(open, (isOpen) => {
  if (isOpen) choice.value = 'release'
})
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="`Excluir a Super task ${superTask?.title ?? ''}`"
    description="Escolha o que fazer com as tarefas filhas."
    width="sm"
  >
    <p v-if="blockedBySprint" class="text-danger mb-3 text-sm" role="alert" data-testid="delete-blocked">
      {{ SUPER_TASK_REASON.deleteInSprint }}
    </p>

    <fieldset class="flex flex-col gap-3 text-sm">
      <legend class="sr-only">Destino das filhas</legend>

      <label class="flex cursor-pointer items-start gap-2">
        <input v-model="choice" type="radio" name="super-task-children" value="release" class="mt-1" />
        <span>
          Soltar as filhas
          <span class="text-muted-foreground block text-xs">
            As tarefas continuam na área, como avulsas. Nada é apagado além da Super task.
          </span>
        </span>
      </label>

      <label class="flex cursor-pointer items-start gap-2">
        <input
          v-model="choice"
          type="radio"
          name="super-task-children"
          value="delete"
          class="mt-1"
          :disabled="deleteTogetherBlocked"
        />
        <span>
          Excluir as filhas junto
          <span v-if="deleteTogetherBlocked" class="text-muted-foreground block text-xs">
            {{ SUPER_TASK_REASON.deleteTogetherDone }}
          </span>
        </span>
      </label>
      <p v-if="choice === 'delete'" class="text-danger text-xs" role="alert">
        As filhas serão excluídas e essa ação não pode ser desfeita.
      </p>
    </fieldset>

    <template #footer>
      <div class="flex justify-end gap-2">
        <BaseButton variant="outline" :disabled="loading" @click="open = false">Cancelar</BaseButton>
        <BaseButton
          variant="danger"
          :loading="loading"
          :disabled="confirmDisabled"
          data-testid="confirm-delete-super-task"
          @click="emit('confirm', choice)"
        >
          Excluir Super task
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
