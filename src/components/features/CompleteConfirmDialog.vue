<script setup lang="ts">
import { computed } from 'vue'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

/**
 * Confirmação de conclusão, reutilizável (Sprint, Tarefas e, na F#148, a Home). Concluir é
 * definitivo no backend, então o texto deixa claro que não dá para desfazer.
 */
const props = defineProps<{
  /** Nome da tarefa ou do item da rotina. */
  name: string
  kind: 'task' | 'routine'
  /** Se concluir agora conta como atraso (pontos reduzidos a 20%). */
  overdue?: boolean
  points?: number | null
  reducedPoints?: number | null
  loading?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()

const noun = computed(() => (props.kind === 'task' ? 'a tarefa' : 'o item da rotina'))
const showPenalty = computed(() => props.kind === 'task' && props.overdue)
</script>

<template>
  <ConfirmDialog
    v-model:open="open"
    :title="kind === 'task' ? 'Concluir tarefa' : 'Concluir rotina'"
    :message="`Concluir ${noun} ${name}? Essa ação não pode ser desfeita: depois de concluída, não dá para desmarcar nem editar.`"
    confirm-text="Concluir"
    :destructive="false"
    :loading="loading"
    @confirm="emit('confirm')"
  >
    <p v-if="showPenalty" class="text-warning" role="note" data-testid="late-warning">
      Está atrasada: ao concluir agora ela vale 20% dos pontos<template v-if="reducedPoints != null && points != null">
        ({{ reducedPoints }} de {{ points }} pts)</template
      >.
    </p>
  </ConfirmDialog>
</template>
