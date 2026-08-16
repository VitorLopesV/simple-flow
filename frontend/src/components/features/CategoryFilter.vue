<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import type { OpcaoSelect } from '@/types/common'

const props = withDefaults(
  defineProps<{
    categorias: OpcaoSelect<string>[]
    categoriaId: string | null
    busca: string
    /** Filtro extra opcional (ex.: status de pagamento nas saídas). */
    opcoesExtra?: OpcaoSelect<string>[] | null
    valorExtra?: string | null
    rotuloExtra?: string
    temFiltroAtivo?: boolean
  }>(),
  { opcoesExtra: null, valorExtra: null, rotuloExtra: 'Status', temFiltroAtivo: false },
)

const emit = defineEmits<{
  'update:categoriaId': [valor: string | null]
  'update:busca': [valor: string]
  'update:valorExtra': [valor: string | null]
  limpar: []
}>()

const categoriaSelecionada = computed({
  get: () => props.categoriaId,
  set: (valor) => emit('update:categoriaId', valor),
})

const extraSelecionado = computed({
  get: () => props.valorExtra,
  set: (valor) => emit('update:valorExtra', valor),
})

// Busca com debounce para não disparar uma requisição por tecla digitada.
const textoBusca = ref(props.busca)
let temporizador: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.busca,
  (valor) => {
    if (valor !== textoBusca.value) textoBusca.value = valor
  },
)

watch(textoBusca, (valor) => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => emit('update:busca', String(valor ?? '')), 350)
})
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
    <div class="sm:max-w-xs sm:flex-1">
      <BaseInput
        v-model="textoBusca"
        label="Buscar"
        placeholder="Descrição ou observação"
        inputmode="search"
        type="search"
      >
        <template #prefixo>
          <Search class="size-4" aria-hidden="true" />
        </template>
      </BaseInput>
    </div>

    <div class="sm:w-56">
      <BaseSelect
        v-model="categoriaSelecionada"
        label="Categoria"
        placeholder="Todas as categorias"
        permite-vazio
        :opcoes="categorias"
      />
    </div>

    <div v-if="opcoesExtra" class="sm:w-44">
      <BaseSelect
        v-model="extraSelecionado"
        :label="rotuloExtra"
        placeholder="Todos"
        permite-vazio
        :opcoes="opcoesExtra"
      />
    </div>

    <BaseButton v-if="temFiltroAtivo" variante="ghost" class="sm:mb-0.5" @click="emit('limpar')">
      <X class="size-4" aria-hidden="true" />
      Limpar filtros
    </BaseButton>
  </div>
</template>
