<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import { normalizeReward, REWARD_MAX_LENGTH } from '@/types/sprint'
import { compose, maxLength } from '@/utils/validators'

interface FormValues {
  reward: string
}

const props = withDefaults(
  defineProps<{
    /** Valor salvo hoje (`null` = vazio). */
    modelValue: string | null
    label: string
    hint?: string
    placeholder?: string
    submitLabel?: string
    saving?: boolean
  }>(),
  { hint: '', placeholder: 'Ex.: Pedir uma pizza', submitLabel: 'Salvar', saving: false },
)

/** Emite o texto aparado; `null` quando vazio (a API volta a usar a recompensa padrão). */
const emit = defineEmits<{ save: [reward: string | null] }>()

const { handleSubmit, resetForm } = useForm<FormValues>({
  initialValues: { reward: props.modelValue ?? '' },
  // Opcional: vazio é válido; só o limite de tamanho (a API recusa mais de 120 com 422).
  validationSchema: { reward: compose(maxLength(REWARD_MAX_LENGTH, 'Recompensa')) },
})

const { value: reward, errorMessage } = useField<string>('reward')

watch(
  () => props.modelValue,
  (value) => resetForm({ values: { reward: value ?? '' } }),
)

const onSubmit = handleSubmit((form) => emit('save', normalizeReward(form.reward)))
</script>

<template>
  <form class="flex flex-col gap-3 sm:flex-row sm:items-end" novalidate data-testid="reward-form" @submit="onSubmit">
    <div class="flex-1">
    <BaseInput
      v-model="reward"
      :label="label"
      :placeholder="placeholder"
      :hint="hint || `Até ${REWARD_MAX_LENGTH} caracteres. Deixe vazio para não definir.`"
      :error="errorMessage"
      autocomplete="off"
    />
    </div>
    <BaseButton type="submit" :loading="saving" class="sm:mb-[1px]">{{ submitLabel }}</BaseButton>
  </form>
</template>
