<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { computed, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import BaseSwitch from '@/components/common/BaseSwitch.vue'
import CurrencyInput from '@/components/common/CurrencyInput.vue'
import type { CardBrand, CreditCard, CreditCardPayload } from '@/types/creditCard'
import { CARD_BRAND_OPTIONS } from '@/types/creditCard'
import {
  compose,
  digitsOnly,
  hexColor,
  maxLength,
  minLength,
  numberBetween,
  positiveAmount,
  required,
} from '@/utils/validators'

interface FormValues {
  name: string
  brand: CardBrand
  lastDigits: string
  limit: number
  closingDay: number
  dueDay: number
  color: string
  active: boolean
}

const props = withDefaults(
  defineProps<{ card?: CreditCard | null; saving?: boolean }>(),
  { card: null, saving: false },
)

const emit = defineEmits<{ save: [payload: CreditCardPayload]; cancel: [] }>()

const isEditing = computed(() => Boolean(props.card))

function initialValues(): FormValues {
  return {
    name: props.card?.name ?? '',
    brand: props.card?.brand ?? 'MASTERCARD',
    lastDigits: props.card?.lastDigits ?? '',
    limit: props.card?.limit ?? 0,
    closingDay: props.card?.closingDay ?? 20,
    dueDay: props.card?.dueDay ?? 27,
    color: props.card?.color ?? '#6366f1',
    active: props.card?.active ?? true,
  }
}

const { handleSubmit, resetForm } = useForm<FormValues>({
  initialValues: initialValues(),
  validationSchema: {
    name: compose(required('Nome'), minLength(2, 'Nome'), maxLength(40, 'Nome')),
    brand: required('Bandeira'),
    lastDigits: digitsOnly(4, 'Últimos dígitos'),
    limit: positiveAmount('Limite'),
    closingDay: numberBetween(1, 31, 'Dia de fechamento'),
    dueDay: numberBetween(1, 28, 'Dia de vencimento'),
    color: hexColor('Cor'),
  },
})

const { value: name, errorMessage: nameError } = useField<string>('name')
const { value: brand, errorMessage: brandError } = useField<string | null>('brand')
const { value: lastDigits, errorMessage: digitsError } = useField<string>('lastDigits')
const { value: limit, errorMessage: limitError } = useField<number>('limit')
const { value: closingDay, errorMessage: closingError } = useField<number>('closingDay')
const { value: dueDay, errorMessage: dueError } = useField<number>('dueDay')
const { value: color } = useField<string>('color')
const { value: active } = useField<boolean>('active')

watch(() => props.card, () => resetForm({ values: initialValues() }))

const onSubmit = handleSubmit((form) => {
  emit('save', {
    name: form.name.trim(),
    brand: form.brand,
    lastDigits: form.lastDigits,
    limit: Number(form.limit),
    closingDay: Number(form.closingDay),
    dueDay: Number(form.dueDay),
    color: form.color,
    active: form.active,
  })
})
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit="onSubmit">
    <BaseInput
      v-model="name"
      label="Nome do cartão"
      placeholder="Ex.: Nubank Ultravioleta"
      :error="nameError"
      required
      :maxlength="40"
      autocomplete="off"
    />

    <div class="grid gap-4 sm:grid-cols-2">
      <BaseSelect
        v-model="brand"
        label="Bandeira"
        :options="CARD_BRAND_OPTIONS"
        :error="brandError"
        required
      />
      <BaseInput
        v-model="lastDigits"
        label="Últimos 4 dígitos"
        placeholder="0000"
        inputmode="numeric"
        :maxlength="4"
        :error="digitsError"
        required
        hint="Nunca guardamos o número completo do cartão."
      />
    </div>

    <CurrencyInput v-model="limit" label="Limite total" :error="limitError" required />

    <div class="grid gap-4 sm:grid-cols-2">
      <BaseInput
        v-model="closingDay"
        label="Dia do fechamento"
        type="number"
        min="1"
        max="31"
        :error="closingError"
        required
      />
      <BaseInput
        v-model="dueDay"
        label="Dia do vencimento"
        type="number"
        min="1"
        max="28"
        :error="dueError"
        required
      />
    </div>

    <div class="flex items-end gap-3">
      <div class="flex flex-col gap-1.5">
        <label for="card-color" class="text-sm font-medium">Cor</label>
        <input
          id="card-color"
          v-model="color"
          type="color"
          class="border-input bg-card h-10 w-16 cursor-pointer rounded-lg border p-1"
        />
      </div>
      <p class="text-muted-foreground pb-2.5 text-xs">
        Usada para identificar o cartão nas listagens.
      </p>
    </div>

    <BaseSwitch
      v-model="active"
      label="Cartão ativo"
      description="Cartões inativos não aparecem nas formas de pagamento."
    />

    <div class="flex justify-end gap-2 pt-2">
      <BaseButton variant="outline" :disabled="saving" @click="emit('cancel')">
        Cancelar
      </BaseButton>
      <BaseButton type="submit" :loading="saving">
        {{ isEditing ? 'Salvar alterações' : 'Adicionar cartão' }}
      </BaseButton>
    </div>
  </form>
</template>
