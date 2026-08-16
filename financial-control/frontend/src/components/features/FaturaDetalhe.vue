<script setup lang="ts">
import { CalendarCheck, CircleCheck, Receipt } from '@lucide/vue'
import { computed } from 'vue'

import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useCategoriaStore } from '@/stores/categoriaStore'
import type { CartaoComFatura } from '@/types/cartao'
import { FATURA_STATUS_LABEL } from '@/types/cartao'
import { formatCurrency } from '@/utils/currencyFormatter'
import { diasAte, formatDate } from '@/utils/dateFormatter'

const props = defineProps<{ item: CartaoComFatura | null; processando?: boolean }>()
const emit = defineEmits<{ pagar: [faturaId: string] }>()

const categoriaStore = useCategoriaStore()

const fatura = computed(() => props.item?.fatura ?? null)
const transacoes = computed(() => fatura.value?.transacoes ?? [])

const podePagar = computed(() => Boolean(fatura.value) && fatura.value?.status !== 'PAGA')

const avisoVencimento = computed(() => {
  if (!fatura.value || fatura.value.status === 'PAGA') return null
  const dias = diasAte(fatura.value.vencimento)
  if (dias < 0) return { tom: 'perigo' as const, texto: `Vencida há ${Math.abs(dias)} dia(s)` }
  if (dias === 0) return { tom: 'aviso' as const, texto: 'Vence hoje' }
  if (dias <= 5) return { tom: 'aviso' as const, texto: `Vence em ${dias} dia(s)` }
  return { tom: 'info' as const, texto: `Vence em ${dias} dia(s)` }
})

/** Total por categoria dentro da fatura, para leitura rápida do gasto. */
const resumoCategorias = computed(() => {
  const agrupado = new Map<string, number>()
  for (const transacao of transacoes.value) {
    agrupado.set(transacao.categoriaId, (agrupado.get(transacao.categoriaId) ?? 0) + transacao.valor)
  }
  return [...agrupado.entries()]
    .map(([categoriaId, total]) => ({ categoriaId, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)
})
</script>

<template>
  <BaseCard sem-padding>
    <template #cabecalho>
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-base font-semibold">
          Fatura {{ item ? item.cartao.nome : '' }}
        </h2>
        <BaseBadge v-if="fatura" :tom="fatura.status === 'PAGA' ? 'sucesso' : 'info'">
          {{ FATURA_STATUS_LABEL[fatura.status] }}
        </BaseBadge>
        <BaseBadge v-if="avisoVencimento" :tom="avisoVencimento.tom">
          {{ avisoVencimento.texto }}
        </BaseBadge>
      </div>
      <p v-if="fatura" class="text-muted-foreground mt-0.5 text-sm">
        Fechamento em {{ formatDate(fatura.fechamento) }} · Vencimento em
        {{ formatDate(fatura.vencimento) }}
      </p>
    </template>

    <template v-if="fatura" #acoes>
      <BaseButton
        v-if="podePagar"
        variante="success"
        tamanho="sm"
        :carregando="processando"
        @click="emit('pagar', fatura.id)"
      >
        <CircleCheck class="size-4" aria-hidden="true" />
        Marcar como paga
      </BaseButton>
      <BaseBadge v-else tom="sucesso">
        <CalendarCheck class="size-3.5" aria-hidden="true" />
        Paga em {{ formatDate(fatura.pagoEm) }}
      </BaseBadge>
    </template>

    <EmptyState
      v-if="!fatura"
      titulo="Sem fatura neste período"
      descricao="Este cartão não possui fatura gerada para o mês selecionado."
    >
      <template #icone>
        <Receipt class="size-6" aria-hidden="true" />
      </template>
    </EmptyState>

    <template v-else>
      <div class="border-border grid gap-4 border-b p-5 sm:grid-cols-3">
        <div>
          <p class="text-muted-foreground text-xs">Total da fatura</p>
          <p class="numero-tabular text-2xl font-semibold">{{ formatCurrency(fatura.total) }}</p>
        </div>
        <div>
          <p class="text-muted-foreground text-xs">Transações</p>
          <p class="numero-tabular text-2xl font-semibold">{{ transacoes.length }}</p>
        </div>
        <div>
          <p class="text-muted-foreground text-xs">Maiores categorias</p>
          <ul class="mt-1 flex flex-wrap gap-1.5">
            <li v-for="linha in resumoCategorias" :key="linha.categoriaId">
              <BaseBadge :cor="categoriaStore.cor(linha.categoriaId)">
                {{ categoriaStore.nome(linha.categoriaId) }} · {{ formatCurrency(linha.total) }}
              </BaseBadge>
            </li>
          </ul>
        </div>
      </div>

      <div class="scroll-suave max-h-[28rem] overflow-y-auto">
        <table class="w-full text-sm">
          <caption class="sr-only">
            Transações da fatura selecionada
          </caption>
          <thead class="bg-card sticky top-0 z-10">
            <tr class="text-muted-foreground border-border border-b text-left">
              <th scope="col" class="px-5 py-3 font-medium">Descrição</th>
              <th scope="col" class="hidden px-5 py-3 font-medium sm:table-cell">Categoria</th>
              <th scope="col" class="px-5 py-3 font-medium">Data</th>
              <th scope="col" class="px-5 py-3 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="transacao in transacoes"
              :key="transacao.id"
              class="border-border hover:bg-muted/50 border-b transition-colors last:border-0"
            >
              <td class="px-5 py-3">
                <span class="font-medium">{{ transacao.descricao }}</span>
                <span
                  v-if="transacao.totalParcelas > 1"
                  class="text-muted-foreground numero-tabular ml-2 text-xs"
                >
                  {{ transacao.parcelaAtual }}/{{ transacao.totalParcelas }}
                </span>
              </td>
              <td class="hidden px-5 py-3 sm:table-cell">
                <BaseBadge :cor="categoriaStore.cor(transacao.categoriaId)">
                  {{ categoriaStore.nome(transacao.categoriaId) }}
                </BaseBadge>
              </td>
              <td class="text-muted-foreground numero-tabular px-5 py-3 whitespace-nowrap">
                {{ formatDate(transacao.data) }}
              </td>
              <td class="numero-tabular px-5 py-3 text-right font-semibold">
                {{ formatCurrency(transacao.valor) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseCard>
</template>
