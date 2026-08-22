<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseCard from '@/components/common/BaseCard.vue'

const router = useRouter()

const email = ref('')
const senha = ref('')
const carregando = ref(false)
const erros = ref<Record<string, string>>({})

const handleSubmit = async () => {
  erros.value = {}

  if (!email.value) {
    erros.value.email = 'E-mail é obrigatório'
  } else if (!isValidEmail(email.value)) {
    erros.value.email = 'E-mail inválido'
  }

  if (!senha.value) {
    erros.value.senha = 'Senha é obrigatória'
  } else if (senha.value.length < 6) {
    erros.value.senha = 'Senha deve ter no mínimo 6 caracteres'
  }

  if (Object.keys(erros.value).length > 0) {
    return
  }

  carregando.value = true

  try {
    // Aqui você fará a chamada à API de login
    // const response = await authService.login(email.value, senha.value)
    // Simule o login
    await new Promise((resolve) => setTimeout(resolve, 1500))

    toast.success('Login realizado com sucesso!')
    await router.push({ name: 'dashboard' })
  } catch (error) {
    toast.error('Erro ao fazer login. Verifique seus dados.')
  } finally {
    carregando.value = false
  }
}

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
</script>

<template>
  <div class="w-full max-w-md">
    <BaseCard class="border shadow-lg">
      <div class="space-y-6">
        <!-- Logo -->
        <div class="flex justify-center mb-2">
          <img src="@/img/simple-flow-logo.png" alt="SimpleFlow" class="h-32 w-auto" />
        </div>

        <!-- Header -->
        <div class="text-center">
          <h1 class="text-2xl font-bold">Bem-vindo de volta</h1>
          <p class="text-muted-foreground mt-2 text-sm">Faça login na sua conta para continuar</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <BaseInput
            v-model="email"
            label="E-mail"
            tipo="text"
            placeholder="seu@email.com"
            :erro="erros.email"
            autocomplete="email"
          />

          <BaseInput
            v-model="senha"
            label="Senha"
            tipo="password"
            placeholder="••••••••"
            :erro="erros.senha"
            autocomplete="current-password"
          />

          <BaseButton
            tipo="submit"
            :carregando="carregando"
            :desabilitado="carregando"
            blocoCompleto
          >
            Entrar
          </BaseButton>
        </form>

        <!-- Footer -->
        <div class="space-y-3 text-center text-sm">
          <p class="text-muted-foreground">
            Não tem uma conta?
            <RouterLink :to="{ name: 'registro' }" class="text-primary hover:underline font-medium">
              Registre-se aqui
            </RouterLink>
          </p>

        </div>
      </div>
    </BaseCard>
  </div>
</template>
