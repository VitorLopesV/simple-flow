<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { computed, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import type { Area, AreaPayload } from '@/types/area'
import { AREA_COLORS, DEFAULT_AREA_COLOR } from '@/types/area'
import { compose, maxLength, minLength, oneOf, required } from '@/utils/validators'

interface FormValues {
  name: string
  color: string
}

const props = withDefaults(defineProps<{ area?: Area | null; saving?: boolean }>(), {
  area: null,
  saving: false,
})

const emit = defineEmits<{ save: [payload: AreaPayload]; cancel: [] }>()

const isEditing = computed(() => Boolean(props.area))

function initialValues(): FormValues {
  return { name: props.area?.name ?? '', color: props.area?.color ?? DEFAULT_AREA_COLOR }
}

const { handleSubmit, resetForm } = useForm<FormValues>({
  initialValues: initialValues(),
  validationSchema: {
    name: compose(required('Nome'), minLength(2, 'Nome'), maxLength(60, 'Nome')),
    color: oneOf(
      AREA_COLORS.map((item) => item.value),
      'Cor',
    ),
  },
})

const { value: name, errorMessage: nameError } = useField<string>('name')
const { value: color } = useField<string>('color')

watch(() => props.area, () => resetForm({ values: initialValues() }))

const onSubmit = handleSubmit((form) => {
  emit('save', { name: form.name.trim(), color: form.color })
})
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit="onSubmit">
    <BaseInput
      v-model="name"
      label="Nome da área"
      placeholder="Ex.: Trabalho"
      :error="nameError"
      required
      :maxlength="60"
      autocomplete="off"
    />

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1.5 text-sm font-medium">Cor</legend>
      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor da área">
        <button
          v-for="option in AREA_COLORS"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="color === option.value"
          :aria-label="option.label"
          :title="option.label"
          class="focus-visible:ring-ring size-8 cursor-pointer rounded-full border-2 outline-none transition focus-visible:ring-2"
          :class="color === option.value ? 'border-foreground scale-110' : 'border-transparent'"
          :style="{ backgroundColor: option.value }"
          @click="color = option.value"
        />
      </div>
    </fieldset>

    <div class="flex justify-end gap-2 pt-2">
      <BaseButton variant="outline" :disabled="saving" @click="emit('cancel')">Cancelar</BaseButton>
      <BaseButton type="submit" :loading="saving">
        {{ isEditing ? 'Salvar alterações' : 'Adicionar área' }}
      </BaseButton>
    </div>
  </form>
</template>
