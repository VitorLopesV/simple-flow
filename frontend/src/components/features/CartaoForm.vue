<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { computed, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import BaseSwitch from '@/components/common/BaseSwitch.vue'
import CurrencyInput from '@/components/common/CurrencyInput.vue'
import type { Bandeira, Cartao, CartaoPayload } from '@/types/cartao'
import { BANDEIRA_OPCOES } from '@/types/cartao'
import {
  compor,
  corHexadecimal,
  maximoCaracteres,
  minimoCaracteres,
  numeroEntre,
  obrigatorio,
  somenteDigitos,
  valorMonetarioPositivo,
} from '@/utils/validators'

interface Valores {
  nome: string
  bandeira: Bandeira
  ultimosDigitos: string
  limite: number
  diaFechamento: number
  diaVencimento: number
  cor: string
  ativo: boolean
}

const props = withDefaults(
  defineProps<{ cartao?: Cartao | null; salvando?: boolean }>(),
  { cartao: null, salvando: false },
)

const emit = defineEmits<{ salvar: [payload: CartaoPayload]; cancelar: [] }>()

const ehEdicao = computed(() => Boolean(props.cartao))

function valoresIniciais(): Valores {
  return {
    nome: props.cartao?.nome ?? '',
    bandeira: props.cartao?.bandeira ?? 'MASTERCARD',
    ultimosDigitos: props.cartao?.ultimosDigitos ?? '',
    limite: props.cartao?.limite ?? 0,
    diaFechamento: props.cartao?.diaFechamento ?? 20,
    diaVencimento: props.cartao?.diaVencimento ?? 27,
    cor: props.cartao?.cor ?? '#6366f1',
    ativo: props.cartao?.ativo ?? true,
  }
}

const { handleSubmit, resetForm } = useForm<Valores>({
  initialValues: valoresIniciais(),
  validationSchema: {
    nome: compor(obrigatorio('Nome'), minimoCaracteres(2, 'Nome'), maximoCaracteres(40, 'Nome')),
    bandeira: obrigatorio('Bandeira'),
    ultimosDigitos: somenteDigitos(4, 'Últimos dígitos'),
    limite: valorMonetarioPositivo('Limite'),
    diaFechamento: numeroEntre(1, 31, 'Dia de fechamento'),
    diaVencimento: numeroEntre(1, 28, 'Dia de vencimento'),
    cor: corHexadecimal('Cor'),
  },
})

const { value: nome, errorMessage: erroNome } = useField<string>('nome')
const { value: bandeira, errorMessage: erroBandeira } = useField<string | null>('bandeira')
const { value: ultimosDigitos, errorMessage: erroDigitos } = useField<string>('ultimosDigitos')
const { value: limite, errorMessage: erroLimite } = useField<number>('limite')
const { value: diaFechamento, errorMessage: erroFechamento } = useField<number>('diaFechamento')
const { value: diaVencimento, errorMessage: erroVencimento } = useField<number>('diaVencimento')
const { value: cor } = useField<string>('cor')
const { value: ativo } = useField<boolean>('ativo')

watch(() => props.cartao, () => resetForm({ values: valoresIniciais() }))

const aoSubmeter = handleSubmit((formulario) => {
  emit('salvar', {
    nome: formulario.nome.trim(),
    bandeira: formulario.bandeira,
    ultimosDigitos: formulario.ultimosDigitos,
    limite: Number(formulario.limite),
    diaFechamento: Number(formulario.diaFechamento),
    diaVencimento: Number(formulario.diaVencimento),
    cor: formulario.cor,
    ativo: formulario.ativo,
  })
})
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit="aoSubmeter">
    <BaseInput
      v-model="nome"
      label="Nome do cartão"
      placeholder="Ex.: Nubank Ultravioleta"
      :erro="erroNome"
      obrigatorio
      :maxlength="40"
      autocomplete="off"
    />

    <div class="grid gap-4 sm:grid-cols-2">
      <BaseSelect
        v-model="bandeira"
        label="Bandeira"
        :opcoes="BANDEIRA_OPCOES"
        :erro="erroBandeira"
        obrigatorio
      />
      <BaseInput
        v-model="ultimosDigitos"
        label="Últimos 4 dígitos"
        placeholder="0000"
        inputmode="numeric"
        :maxlength="4"
        :erro="erroDigitos"
        obrigatorio
        dica="Nunca guardamos o número completo do cartão."
      />
    </div>

    <CurrencyInput v-model="limite" label="Limite total" :erro="erroLimite" obrigatorio />

    <div class="grid gap-4 sm:grid-cols-2">
      <BaseInput
        v-model="diaFechamento"
        label="Dia do fechamento"
        type="number"
        min="1"
        max="31"
        :erro="erroFechamento"
        obrigatorio
      />
      <BaseInput
        v-model="diaVencimento"
        label="Dia do vencimento"
        type="number"
        min="1"
        max="28"
        :erro="erroVencimento"
        obrigatorio
      />
    </div>

    <div class="flex items-end gap-3">
      <div class="flex flex-col gap-1.5">
        <label for="cor-cartao" class="text-sm font-medium">Cor</label>
        <input
          id="cor-cartao"
          v-model="cor"
          type="color"
          class="border-input bg-card h-10 w-16 cursor-pointer rounded-lg border p-1"
        />
      </div>
      <p class="text-muted-foreground pb-2.5 text-xs">
        Usada para identificar o cartão nas listagens.
      </p>
    </div>

    <BaseSwitch
      v-model="ativo"
      label="Cartão ativo"
      descricao="Cartões inativos não aparecem nas formas de pagamento."
    />

    <div class="flex justify-end gap-2 pt-2">
      <BaseButton variante="outline" :desabilitado="salvando" @click="emit('cancelar')">
        Cancelar
      </BaseButton>
      <BaseButton tipo="submit" :carregando="salvando">
        {{ ehEdicao ? 'Salvar alterações' : 'Adicionar cartão' }}
      </BaseButton>
    </div>
  </form>
</template>
