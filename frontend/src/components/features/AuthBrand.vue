<script setup lang="ts">
import simpleFlowLogo from '@/img/simple-flow-logo.svg'

withDefaults(defineProps<{ align?: 'center' | 'start' }>(), { align: 'center' })
</script>

<template>
  <!--
    A logo traz o nome em branco (feito para fundo escuro): aqui só o símbolo é usado,
    recortado, e o nome vira texto com a cor do tema — legível no claro e no escuro.
  -->
  <div class="flex flex-col" :class="align === 'center' ? 'items-center' : 'items-start'">
    <div class="h-[86px] overflow-hidden">
      <img :src="simpleFlowLogo" alt="" class="-mt-10 block w-40 max-w-none" />
    </div>
    <span class="text-foreground mt-1 text-2xl font-light tracking-[0.2em]">SimpleFlow</span>
  </div>
</template>
