<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { computed, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import BaseSwitch from '@/components/common/BaseSwitch.vue'
import BaseTextarea from '@/components/common/BaseTextarea.vue'
import CurrencyInput from '@/components/common/CurrencyInput.vue'
import DateInput from '@/components/common/DateInput.vue'
import { useCategoryStore } from '@/stores/categoryStore'
import type { CardTransaction, CardTransactionPayload } from '@/types/creditCard'
import type { SelectOption } from '@/types/common'
import type { Movement } from '@/types/category'
import type { Income, IncomePayload, IncomeType } from '@/types/income'
import { INCOME_TYPE_OPTIONS } from '@/types/income'
import type { Expense, ExpensePayload, ExpenseStatus, ExpenseType, PaymentMethod } from '@/types/expense'
import { EXPENSE_STATUS_OPTIONS, EXPENSE_TYPE_OPTIONS, PAYMENT_METHOD_OPTIONS } from '@/types/expense'
import { toISODate } from '@/utils/dateFormatter'
import {
  compose,
  isoDate,
  maxLength,
  minLength,
  numberBetween,
  positiveAmount,
  required,
} from '@/utils/validators'

interface FormValues {
  description: string
  amount: number
  date: string
  categoryId: string | null
  recurring: boolean
  notes: string
  status: ExpenseStatus
  dueDate: string
  paymentMethod: PaymentMethod
  /** `ExpenseType` em saídas/cartão, `IncomeType` em entradas; vazio só numa entrada nova. */
  type: ExpenseType | IncomeType | null
  installmentCount: number
}

const props = withDefaults(
  defineProps<{
    /** Define quais campos aparecem e o formato do payload emitido. */
    kind: Movement
    /**
     * `card` = débito lançado direto num cartão: mesmos campos de uma saída, sem
     * forma de pagamento (é sempre o cartão) e sem situação (quem é paga é a fatura).
     */
    context?: 'default' | 'card'
    transaction?: Income | Expense | CardTransaction | null
    categories: SelectOption<string>[]
    saving?: boolean
  }>(),
  { context: 'default', transaction: null, saving: false },
)

const emit = defineEmits<{
  save: [payload: IncomePayload | ExpensePayload | CardTransactionPayload]
  cancel: []
}>()

const categoryStore = useCategoryStore()

const isCard = computed(() => props.context === 'card')
const isExpense = computed(() => props.kind === 'SAIDA')
const isEditing = computed(() => Boolean(props.transaction))

function initialValues(): FormValues {
  const transaction = props.transaction
  const expense = transaction as Expense | null

  return {
    description: transaction?.description ?? '',
    amount: transaction?.amount ?? 0,
    date: transaction?.date ?? toISODate(new Date()),
    categoryId: transaction?.categoryId ?? null,
    recurring: transaction?.recurring ?? false,
    notes: transaction?.notes ?? '',
    status: expense?.status ?? 'PENDENTE',
    dueDate: expense?.dueDate ?? '',
    paymentMethod: expense?.paymentMethod ?? 'PIX',
    // Saída já nasce com "Outros"; entrada começa vazia para o usuário escolher o tipo.
    type: transaction?.type ?? (isExpense.value ? 'OUTROS' : null),
    // No cartão, a edição mostra o parcelamento já existente (somente leitura).
    installmentCount: (transaction as CardTransaction | null)?.totalInstallments ?? 1,
  }
}

const { handleSubmit, resetForm } = useForm<FormValues>({
  initialValues: initialValues(),
  validationSchema: {
    description: compose(
      required('Descrição'),
      minLength(3, 'Descrição'),
      maxLength(80, 'Descrição'),
    ),
    amount: positiveAmount('Valor'),
    date: compose(required('Data'), isoDate('Data')),
    categoryId: required('Categoria'),
    type: required('Tipo'),
    // Vencimento é opcional: só valida o formato quando o usuário preenche algo.
    dueDate: (value: unknown) => (String(value ?? '').trim() === '' ? true : isoDate('Vencimento')(value)),
    notes: maxLength(280, 'Observação'),
    installmentCount: numberBetween(1, 30, 'Parcelas'),
  },
})

const { value: description, errorMessage: descriptionError } = useField<string>('description')
const { value: amount, errorMessage: amountError } = useField<number>('amount')
const { value: categoryId, errorMessage: categoryError } = useField<string | null>('categoryId')
const { value: recurring } = useField<boolean>('recurring')

/**
 * Recorrência só existe em categoria fixa (Despesa Fixa / Renda Fixa — o backend
 * recusa nas demais). Nas outras o toggle fica desligado e indisponível.
 */
const recurringAvailable = computed(() => categoryStore.isFixed(categoryId.value))

/**
 * Escolher a categoria no formulário liga a recorrência numa categoria fixa (o
 * usuário ainda pode desligar) e desliga nas demais. Só reage à escolha do usuário:
 * abrir um registro para edição mantém a recorrência que ele já tem.
 */
function onCategoryChange(id: string | null): void {
  recurring.value = categoryStore.isFixed(id)
}

// Nome de um lançamento recorrente é imutável entre os meses da série — travado na
// edição enquanto a recorrência estiver ligada; desligar libera o nome.
const nameLocked = computed(
  () => isEditing.value && Boolean(props.transaction?.recurring) && recurring.value,
)

// Religar a recorrência volta ao nome original (é o que o backend mantém).
watch(nameLocked, (locked) => {
  if (locked && props.transaction) description.value = props.transaction.description
})
const { value: notes, errorMessage: notesError } = useField<string>('notes')
const { value: status } = useField<ExpenseStatus>('status')
const { value: dueDate, errorMessage: dueDateError } = useField<string>('dueDate')
const { value: paymentMethod } = useField<PaymentMethod>('paymentMethod')
const { value: type, errorMessage: typeError } = useField<ExpenseType | IncomeType | null>('type')
const { value: installmentCount, errorMessage: installmentsError } = useField<number>('installmentCount')

// Compra parcelada e lançamento recorrente são conceitos diferentes (fim previsto x
// repetição infinita) — não fazem sentido juntos, então desligamos um ao ligar o outro.
const showRecurring = computed(() => !isCard.value || isEditing.value || Number(installmentCount.value) <= 1)

// Lançamento recorrente não tem quantidade de parcelas: trava o campo em 1 e ignora
// o que estiver nele ao salvar.
// Na edição o parcelamento é fixo (não recria parcelas), então o campo fica travado.
const installmentsLocked = computed(
  () => isCard.value && (isEditing.value || (recurring.value && recurringAvailable.value)),
)

watch(installmentCount, (current) => {
  if (!isEditing.value && Number(current) > 1) recurring.value = false
})

watch(recurring, (current) => {
  if (isCard.value && !isEditing.value && current) installmentCount.value = 1
})

// Reabrir o modal com outra transação recarrega o formulário.
watch(
  () => props.transaction,
  () => resetForm({ values: initialValues() }),
)

/**
 * Sem campo "Data" visível no formulário de entrada/saída: um registro novo usa a data
 * de hoje e a edição mantém a data do próprio registro — cada mês de uma série
 * recorrente é um registro real, com a data do seu mês.
 */
function entryDate(): string {
  return props.transaction?.date ?? toISODate(new Date())
}

const pendingConfirmationOpen = ref(false)
const waitingForm = ref<FormValues | null>(null)

/** Editar uma saída paga para pendente exige confirmação, para evitar alteração acidental. */
function wouldBecomePending(form: FormValues): boolean {
  const original = props.transaction as Expense | null
  return isExpense.value && !isCard.value && original?.status === 'PAGO' && form.status === 'PENDENTE'
}

const onSubmit = handleSubmit((form) => {
  if (wouldBecomePending(form)) {
    waitingForm.value = { ...form }
    pendingConfirmationOpen.value = true
    return
  }
  emitSave(form)
})

function confirmPending(): void {
  const form = waitingForm.value
  pendingConfirmationOpen.value = false
  waitingForm.value = null
  if (form) emitSave(form)
}

function cancelPending(): void {
  waitingForm.value = null
}

function emitSave(form: FormValues): void {
  const base = {
    description: form.description.trim(),
    amount: Number(form.amount),
    date: form.date,
    categoryId: form.categoryId as string,
    // Fora de categoria fixa nunca vai recorrente (registros antigos podem estar marcados).
    recurring: form.recurring && categoryStore.isFixed(form.categoryId),
    notes: form.notes.trim() || undefined,
  }

  if (!isExpense.value) {
    emit('save', {
      ...base,
      type: form.type as IncomeType,
      date: entryDate(),
    } satisfies IncomePayload)
    return
  }

  if (isCard.value) {
    // Parcelamento não é editável por aqui: preserva o que a transação já tinha.
    // Numa transação nova, a quantidade de parcelas escolhida vira totalInstallments —
    // é quem chama (creditCardStore) que divide o valor e lança uma por fatura futura.
    const current = props.transaction as CardTransaction | null

    emit('save', {
      ...base,
      type: form.type as ExpenseType,
      installment: current?.installment ?? 1,
      totalInstallments: current?.totalInstallments ?? (base.recurring ? 1 : Number(form.installmentCount)),
    } satisfies CardTransactionPayload)
    return
  }

  emit('save', {
    ...base,
    date: entryDate(),
    type: form.type as ExpenseType,
    status: form.status,
    dueDate: form.dueDate || null,
    paymentMethod: form.paymentMethod,
    cardId: null,
  } satisfies ExpensePayload)
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit="onSubmit">
    <BaseInput
      v-model="description"
      label="Descrição"
      :placeholder="
        isCard ? 'Ex.: Supermercado' : isExpense ? 'Ex.: Conta de energia' : 'Ex.: Salário mensal'
      "
      :error="descriptionError"
      :hint="
        nameLocked
          ? 'Lançamento recorrente: o nome é o mesmo em todos os meses. Desligue a recorrência para alterá-lo.'
          : ''
      "
      required
      :maxlength="80"
      :disabled="nameLocked"
      autocomplete="off"
    />

    <CurrencyInput v-model="amount" label="Valor" :error="amountError" required />

    <div class="grid gap-4 sm:grid-cols-2">
      <BaseSelect
        v-model="categoryId"
        label="Categoria"
        placeholder="Selecione uma categoria"
        :options="categories"
        :error="categoryError"
        required
        @update:model-value="onCategoryChange"
      />
      <BaseSelect
        v-model="type"
        label="Tipo"
        placeholder="Selecione um tipo"
        :options="isExpense ? EXPENSE_TYPE_OPTIONS : INCOME_TYPE_OPTIONS"
        :error="typeError"
        required
      />
    </div>

    <div v-if="isExpense && !isCard" class="grid gap-4 sm:grid-cols-2">
      <BaseSelect
        v-model="paymentMethod"
        label="Forma de pagamento"
        :options="PAYMENT_METHOD_OPTIONS"
      />
      <BaseSelect v-model="status" label="Situação" :options="EXPENSE_STATUS_OPTIONS" />
    </div>

    <DateInput
      v-if="isExpense && !isCard"
      v-model="dueDate"
      label="Data de vencimento"
      :error="dueDateError"
      hint="Opcional. A data de pagamento é registrada automaticamente quando a situação muda para Pago."
    />

    <BaseInput
      v-if="isCard"
      v-model="installmentCount"
      label="Quantidade de parcelas"
      type="number"
      min="1"
      max="30"
      :error="installmentsError"
      :disabled="installmentsLocked"
      :hint="
        isEditing
          ? 'O parcelamento não pode ser alterado depois de lançado.'
          : installmentsLocked
          ? 'Lançamento recorrente não tem parcelas.'
          : 'Divide o valor em parcelas iguais, uma lançada em cada fatura.'
      "
      required
    />

    <BaseSwitch
      v-if="showRecurring"
      :model-value="recurring && recurringAvailable"
      label="Lançamento recorrente"
      :disabled="!recurringAvailable"
      :description="
        !recurringAvailable
          ? `Disponível apenas para ${isExpense ? 'Despesa Fixa' : 'Renda Fixa'}`
          : isCard
            ? 'Repete todo mês na fatura (assinatura, mensalidade...)'
            : isExpense
              ? 'Repete todo mês (aluguel, assinatura...)'
              : 'Receita fixa mensal'
      "
      @update:model-value="recurring = $event"
    />

    <BaseTextarea
      v-model="notes"
      label="Observação"
      placeholder="Anotações opcionais"
      :error="notesError"
    />

    <div class="flex justify-end gap-2 pt-2">
      <BaseButton variant="outline" :disabled="saving" @click="emit('cancel')">
        Cancelar
      </BaseButton>
      <BaseButton type="submit" :loading="saving">
        {{ isEditing ? 'Salvar alterações' : 'Adicionar' }}
      </BaseButton>
    </div>

    <ConfirmDialog
      v-model:open="pendingConfirmationOpen"
      title="Alterar para pendente"
      :message="`Deseja realmente alterar “${transaction?.description ?? ''}” de pago para pendente?`"
      confirm-text="Alterar para pendente"
      :destructive="false"
      @confirm="confirmPending"
      @cancel="cancelPending"
    />
  </form>
</template>
