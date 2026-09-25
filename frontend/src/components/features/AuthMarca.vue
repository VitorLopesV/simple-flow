<script setup lang="ts">
import logoSimpleFlow from '@/img/simple-flow-logo.svg'

withDefaults(defineProps<{ alinhamento?: 'centro' | 'inicio' }>(), { alinhamento: 'centro' })
</script>

<template>
  <!--
    A logo traz o nome em branco (feito para fundo escuro): aqui só o símbolo é usado,
    recortado, e o nome vira texto com a cor do tema — legível no claro e no escuro.
  -->
  <div class="flex flex-col" :class="alinhamento === 'centro' ? 'items-center' : 'items-start'">
    <div class="h-[86px] overflow-hidden">
      <img :src="logoSimpleFlow" alt="" class="-mt-10 block w-40 max-w-none" />
    </div>
    <span class="text-foreground mt-1 text-2xl font-light tracking-[0.2em]">SimpleFlow</span>
  </div>
</template>
