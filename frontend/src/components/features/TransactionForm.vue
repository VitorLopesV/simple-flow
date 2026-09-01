<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { computed, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import BaseSwitch from '@/components/common/BaseSwitch.vue'
import BaseTextarea from '@/components/common/BaseTextarea.vue'
import CurrencyInput from '@/components/common/CurrencyInput.vue'
import DateInput from '@/components/common/DateInput.vue'
import type { OpcaoSelect } from '@/types/common'
import type { Movimento } from '@/types/categoria'
import type { Entrada, EntradaPayload } from '@/types/entrada'
import type { FormaPagamento, Saida, SaidaPayload, SaidaStatus } from '@/types/saida'
import { FORMA_PAGAMENTO_OPCOES, SAIDA_STATUS_OPCOES } from '@/types/saida'
import { toISODate } from '@/utils/dateFormatter'
import {
  compor,
  dataISO,
  maximoCaracteres,
  minimoCaracteres,
  obrigatorio,
  valorMonetarioPositivo,
} from '@/utils/validators'

interface Valores {
  descricao: string
  valor: number
  data: string
  categoriaId: string | null
  recorrente: boolean
  observacao: string
  status: SaidaStatus
  formaPagamento: FormaPagamento
  cartaoId: string | null
}

const props = withDefaults(
  defineProps<{
    /** Define quais campos aparecem e o formato do payload emitido. */
    tipo: Movimento
    transacao?: Entrada | Saida | null
    categorias: OpcaoSelect<string>[]
    cartoes?: OpcaoSelect<string>[]
    salvando?: boolean
  }>(),
  { transacao: null, cartoes: () => [], salvando: false },
)

const emit = defineEmits<{
  salvar: [payload: EntradaPayload | SaidaPayload]
  cancelar: []
}>()

const ehSaida = computed(() => props.tipo === 'SAIDA')
const ehEdicao = computed(() => Boolean(props.transacao))

function valoresIniciais(): Valores {
  const transacao = props.transacao
  const saida = transacao as Saida | null

  return {
    descricao: transacao?.descricao ?? '',
    valor: transacao?.valor ?? 0,
    data: transacao?.data ?? toISODate(new Date()),
    categoriaId: transacao?.categoriaId ?? null,
    recorrente: transacao?.recorrente ?? false,
    observacao: transacao?.observacao ?? '',
    status: saida?.status ?? 'PAGO',
    formaPagamento: saida?.formaPagamento ?? 'PIX',
    cartaoId: saida?.cartaoId ?? null,
  }
}

const { handleSubmit, resetForm, values } = useForm<Valores>({
  initialValues: valoresIniciais(),
  validationSchema: {
    descricao: compor(
      obrigatorio('Descrição'),
      minimoCaracteres(3, 'Descrição'),
      maximoCaracteres(80, 'Descrição'),
    ),
    valor: valorMonetarioPositivo('Valor'),
    data: compor(obrigatorio('Data'), dataISO('Data')),
    categoriaId: obrigatorio('Categoria'),
    observacao: maximoCaracteres(280, 'Observação'),
    cartaoId: (valor: unknown, ctx: { form?: Record<string, unknown> }) => {
      const forma = ctx.form?.formaPagamento
      return forma === 'CARTAO_CREDITO' && !valor ? 'Selecione o cartão utilizado.' : true
    },
  },
})

const { value: descricao, errorMessage: erroDescricao } = useField<string>('descricao')
const { value: valor, errorMessage: erroValor } = useField<number>('valor')
const { value: data, errorMessage: erroData } = useField<string>('data')
const { value: categoriaId, errorMessage: erroCategoria } = useField<string | null>('categoriaId')
const { value: recorrente } = useField<boolean>('recorrente')
const { value: observacao, errorMessage: erroObservacao } = useField<string>('observacao')
const { value: status } = useField<SaidaStatus>('status')
const { value: formaPagamento } = useField<FormaPagamento>('formaPagamento')
const { value: cartaoId, errorMessage: erroCartao } = useField<string | null>('cartaoId')

const exigeCartao = computed(() => ehSaida.value && values.formaPagamento === 'CARTAO_CREDITO')

// Trocar a forma de pagamento para algo que não é cartão limpa a seleção.
watch(
  () => values.formaPagamento,
  (forma) => {
    if (forma !== 'CARTAO_CREDITO') cartaoId.value = null
  },
)

// Reabrir o modal com outra transação recarrega o formulário.
watch(
  () => props.transacao,
  () => resetForm({ values: valoresIniciais() }),
)

const aoSubmeter = handleSubmit((formulario) => {
  const base = {
    descricao: formulario.descricao.trim(),
    valor: Number(formulario.valor),
    data: formulario.data,
    categoriaId: formulario.categoriaId as string,
    recorrente: formulario.recorrente,
    observacao: formulario.observacao.trim() || undefined,
  }

  if (!ehSaida.value) {
    emit('salvar', base satisfies EntradaPayload)
    return
  }

  emit('salvar', {
    ...base,
    status: formulario.status,
    formaPagamento: formulario.formaPagamento,
    cartaoId: formulario.formaPagamento === 'CARTAO_CREDITO' ? formulario.cartaoId : null,
  } satisfies SaidaPayload)
})
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit="aoSubmeter">
    <BaseInput
      v-model="descricao"
      label="Descrição"
      :placeholder="ehSaida ? 'Ex.: Conta de energia' : 'Ex.: Salário mensal'"
      :erro="erroDescricao"
      obrigatorio
      :maxlength="80"
      autocomplete="off"
    />

    <div class="grid gap-4 sm:grid-cols-2">
      <CurrencyInput v-model="valor" label="Valor" :erro="erroValor" obrigatorio />
      <DateInput
        v-model="data"
        label="Data"
        :erro="erroData"
        :desabilitado="recorrente"
        :dica="recorrente ? 'Data travada enquanto o lançamento for recorrente.' : ''"
        obrigatorio
      />
    </div>

    <BaseSelect
      v-model="categoriaId"
      label="Categoria"
      placeholder="Selecione uma categoria"
      :opcoes="categorias"
      :erro="erroCategoria"
      obrigatorio
    />

    <div v-if="ehSaida" class="grid gap-4 sm:grid-cols-2">
      <BaseSelect
        v-model="formaPagamento"
        label="Forma de pagamento"
        :opcoes="FORMA_PAGAMENTO_OPCOES"
      />
      <BaseSelect v-model="status" label="Situação" :opcoes="SAIDA_STATUS_OPCOES" />
    </div>

    <BaseSelect
      v-if="exigeCartao"
      v-model="cartaoId"
      label="Cartão"
      placeholder="Selecione o cartão"
      :opcoes="cartoes"
      :erro="erroCartao"
      obrigatorio
      :dica="cartoes.length ? '' : 'Nenhum cartão ativo cadastrado.'"
    />

    <BaseSwitch
      v-model="recorrente"
      label="Lançamento recorrente"
      :descricao="ehSaida ? 'Repete todo mês (aluguel, assinatura...)' : 'Receita fixa mensal'"
    />

    <BaseTextarea
      v-model="observacao"
      label="Observação"
      placeholder="Anotações opcionais"
      :erro="erroObservacao"
    />

    <div class="flex justify-end gap-2 pt-2">
      <BaseButton variante="outline" :desabilitado="salvando" @click="emit('cancelar')">
        Cancelar
      </BaseButton>
      <BaseButton tipo="submit" :carregando="salvando">
        {{ ehEdicao ? 'Salvar alterações' : 'Adicionar' }}
      </BaseButton>
    </div>
  </form>
</template>
