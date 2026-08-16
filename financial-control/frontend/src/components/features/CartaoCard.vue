<script setup lang="ts">
import { CreditCard, Pencil, Trash2 } from '@lucide/vue'
import { computed } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import type { CartaoComFatura } from '@/types/cartao'
import { BANDEIRA_LABEL, FATURA_STATUS_LABEL } from '@/types/cartao'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate } from '@/utils/dateFormatter'

const props = defineProps<{ item: CartaoComFatura; selecionado: boolean }>()

const emit = defineEmits<{
  selecionar: [id: string]
  editar: [item: CartaoComFatura]
  remover: [item: CartaoComFatura]
}>()

const cartao = computed(() => props.item.cartao)
const fatura = computed(() => props.item.fatura)

const uso = computed(() => Math.min(100, Math.round(props.item.usoLimite)))
const disponivel = computed(() => Math.max(0, cartao.value.limite - (fatura.value?.total ?? 0)))

const tomStatus = computed(() => {
  switch (fatura.value?.status) {
    case 'PAGA':
      return 'sucesso' as const
    case 'ATRASADA':
      return 'perigo' as const
    case 'FECHADA':
      return 'aviso' as const
    default:
      return 'info' as const
  }
})

const corBarra = computed(() => (uso.value >= 80 ? 'bg-danger' : uso.value >= 50 ? 'bg-warning' : 'bg-success'))
</script>

<template>
  <article
    class="bg-card border-border rounded-card border p-4 shadow-sm transition-shadow"
    :class="selecionado ? 'ring-primary/60 ring-2' : 'hover:shadow-md'"
  >
    <button
      type="button"
      class="focus-visible:outline-ring w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4"
      :aria-pressed="selecionado"
      @click="emit('selecionar', cartao.id)"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
            :style="{ backgroundColor: cartao.cor }"
          >
            <CreditCard class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <p class="truncate font-semibold">{{ cartao.nome }}</p>
            <p class="text-muted-foreground numero-tabular text-xs">
              {{ BANDEIRA_LABEL[cartao.bandeira] }} ····{{ cartao.ultimosDigitos }}
            </p>
          </div>
        </div>

        <BaseBadge v-if="!cartao.ativo" tom="neutro">Inativo</BaseBadge>
        <BaseBadge v-else-if="fatura" :tom="tomStatus">
          {{ FATURA_STATUS_LABEL[fatura.status] }}
        </BaseBadge>
      </div>

      <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt class="text-muted-foreground text-xs">Fatura atual</dt>
          <dd class="numero-tabular font-semibold">{{ formatCurrency(fatura?.total ?? 0) }}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground text-xs">Limite disponível</dt>
          <dd class="numero-tabular font-semibold">{{ formatCurrency(disponivel) }}</dd>
        </div>
      </dl>

      <div class="mt-3">
        <div class="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            class="h-full rounded-full transition-all"
            :class="corBarra"
            :style="{ width: `${uso}%` }"
          />
        </div>
        <p class="text-muted-foreground mt-1.5 text-xs">
          {{ uso }}% do limite de {{ formatCurrency(cartao.limite) }}
          <span v-if="fatura"> · vence em {{ formatDate(fatura.vencimento) }}</span>
        </p>
      </div>
    </button>

    <div class="border-border mt-3 flex justify-end gap-1 border-t pt-3">
      <BaseButton
        variante="ghost"
        tamanho="icon"
        :aria-label="`Editar ${cartao.nome}`"
        @click="emit('editar', item)"
      >
        <Pencil class="size-4" aria-hidden="true" />
      </BaseButton>
      <BaseButton
        variante="ghost"
        tamanho="icon"
        class="hover:text-danger"
        :aria-label="`Excluir ${cartao.nome}`"
        @click="emit('remover', item)"
      >
        <Trash2 class="size-4" aria-hidden="true" />
      </BaseButton>
    </div>
  </article>
</template>
