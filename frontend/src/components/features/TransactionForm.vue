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
import type { TransacaoCartao, TransacaoCartaoPayload } from '@/types/cartao'
import type { OpcaoSelect } from '@/types/common'
import type { Movimento } from '@/types/categoria'
import type { Entrada, EntradaPayload } from '@/types/entrada'
import type { FormaPagamento, Saida, SaidaPayload, SaidaStatus, SaidaTipo } from '@/types/saida'
import { FORMA_PAGAMENTO_OPCOES, SAIDA_STATUS_OPCOES, SAIDA_TIPO_OPCOES } from '@/types/saida'
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
  tipo: SaidaTipo
}

const props = withDefaults(
  defineProps<{
    /** Define quais campos aparecem e o formato do payload emitido. */
    tipo: Movimento
    /**
     * `CARTAO` = débito lançado direto num cartão: mesmos campos de uma saída, sem
     * forma de pagamento (é sempre o cartão) e sem situação (quem é paga é a fatura).
     */
    contexto?: 'PADRAO' | 'CARTAO'
    transacao?: Entrada | Saida | TransacaoCartao | null
    categorias: OpcaoSelect<string>[]
    salvando?: boolean
  }>(),
  { contexto: 'PADRAO', transacao: null, salvando: false },
)

const emit = defineEmits<{
  salvar: [payload: EntradaPayload | SaidaPayload | TransacaoCartaoPayload]
  cancelar: []
}>()

const ehCartao = computed(() => props.contexto === 'CARTAO')
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
    tipo: saida?.tipo ?? 'OUTROS',
  }
}

const { handleSubmit, resetForm } = useForm<Valores>({
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
const { value: tipo } = useField<SaidaTipo>('tipo')

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

  if (ehCartao.value) {
    // Parcelamento não é editável por aqui: preserva o que a transação já tinha.
    const atual = props.transacao as TransacaoCartao | null

    emit('salvar', {
      ...base,
      tipo: formulario.tipo,
      parcelaAtual: atual?.parcelaAtual ?? 1,
      totalParcelas: atual?.totalParcelas ?? 1,
    } satisfies TransacaoCartaoPayload)
    return
  }

  emit('salvar', {
    ...base,
    tipo: formulario.tipo,
    status: formulario.status,
    formaPagamento: formulario.formaPagamento,
    cartaoId: null,
  } satisfies SaidaPayload)
})
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit="aoSubmeter">
    <BaseInput
      v-model="descricao"
      label="Descrição"
      :placeholder="
        ehCartao ? 'Ex.: Supermercado' : ehSaida ? 'Ex.: Conta de energia' : 'Ex.: Salário mensal'
      "
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
        :desabilitado="recorrente && !ehSaida"
        :dica="
          recorrente && !ehSaida
            ? 'Data travada enquanto o lançamento for recorrente.'
            : recorrente && ehSaida
              ? 'Informe a data de pagamento desta conta.'
              : ''
        "
        obrigatorio
      />
    </div>

    <div class="grid gap-4" :class="ehSaida ? 'sm:grid-cols-2' : ''">
      <BaseSelect
        v-model="categoriaId"
        label="Categoria"
        placeholder="Selecione uma categoria"
        :opcoes="categorias"
        :erro="erroCategoria"
        obrigatorio
      />
      <BaseSelect v-if="ehSaida" v-model="tipo" label="Tipo" :opcoes="SAIDA_TIPO_OPCOES" />
    </div>

    <div v-if="ehSaida && !ehCartao" class="grid gap-4 sm:grid-cols-2">
      <BaseSelect
        v-model="formaPagamento"
        label="Forma de pagamento"
        :opcoes="FORMA_PAGAMENTO_OPCOES"
      />
      <BaseSelect v-model="status" label="Situação" :opcoes="SAIDA_STATUS_OPCOES" />
    </div>

    <BaseSwitch
      v-model="recorrente"
      label="Lançamento recorrente"
      :descricao="
        ehCartao
          ? 'Repete todo mês na fatura (assinatura, mensalidade...)'
          : ehSaida
            ? 'Repete todo mês (aluguel, assinatura...)'
            : 'Receita fixa mensal'
      "
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
