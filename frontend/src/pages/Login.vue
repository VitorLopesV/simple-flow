<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import AuthMarca from '@/components/features/AuthMarca.vue'
import { authService } from '@/services/authService'
import { mensagemDeErro } from '@/services/http'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

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
    const sessao = await authService.login({ email: email.value, senha: senha.value })
    authStore.definirSessao(sessao)

    toast.success('Login realizado com sucesso!')
    await router.push({ name: 'dashboard' })
  } catch (error) {
    toast.error(mensagemDeErro(error, 'Erro ao fazer login. Verifique seus dados.'))
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
    <!-- No mobile o painel da marca some (ver AuthLayout): a marca fica acima do card. -->
    <AuthMarca class="mb-6 lg:hidden" />

    <BaseCard class="border shadow-lg">
      <div class="space-y-6">
        <!-- Header -->
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
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
            variante="success"
            tamanho="lg"
            :carregando="carregando"
            :desabilitado="carregando"
            blocoCompleto
          >
            Entrar
          </BaseButton>
        </form>

        <!-- Footer -->
        <div class="border-border border-t pt-5 text-center text-sm">
          <p class="text-muted-foreground">
            Não tem uma conta?
            <RouterLink :to="{ name: 'registro' }" class="text-success hover:underline font-semibold">
              Registre-se aqui
            </RouterLink>
          </p>
        </div>
      </div>
    </BaseCard>
  </div>
</template>
