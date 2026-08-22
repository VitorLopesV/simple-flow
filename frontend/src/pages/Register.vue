<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseCard from '@/components/common/BaseCard.vue'

const router = useRouter()

const nomeUsuario = ref('')
const email = ref('')
const telefone = ref('')
const senha = ref('')
const confirmarSenha = ref('')
const carregando = ref(false)
const erros = ref<Record<string, string>>({})

const handleSubmit = async () => {
  erros.value = {}

  if (!nomeUsuario.value) {
    erros.value.nomeUsuario = 'Nome de usuário é obrigatório'
  } else if (nomeUsuario.value.length < 3) {
    erros.value.nomeUsuario = 'Nome de usuário deve ter no mínimo 3 caracteres'
  }

  if (!email.value) {
    erros.value.email = 'E-mail é obrigatório'
  } else if (!isValidEmail(email.value)) {
    erros.value.email = 'E-mail inválido'
  }

  if (!telefone.value) {
    erros.value.telefone = 'Número de telefone é obrigatório'
  } else if (!isValidPhone(telefone.value)) {
    erros.value.telefone = 'Número de telefone inválido'
  }

  if (!senha.value) {
    erros.value.senha = 'Senha é obrigatória'
  } else if (senha.value.length < 6) {
    erros.value.senha = 'Senha deve ter no mínimo 6 caracteres'
  }

  if (!confirmarSenha.value) {
    erros.value.confirmarSenha = 'Confirmação de senha é obrigatória'
  } else if (senha.value !== confirmarSenha.value) {
    erros.value.confirmarSenha = 'As senhas não coincidem'
  }

  if (Object.keys(erros.value).length > 0) {
    return
  }

  carregando.value = true

  try {
    // Aqui você fará a chamada à API de registro
    // const response = await authService.register({
    //   nomeUsuario: nomeUsuario.value,
    //   email: email.value,
    //   telefone: telefone.value,
    //   senha: senha.value,
    // })
    // Simule o registro
    await new Promise((resolve) => setTimeout(resolve, 1500))

    toast.success('Registrado com sucesso! Redirecionando para login...')
    await router.push({ name: 'login' })
  } catch (error) {
    toast.error('Erro ao registrar. Tente novamente.')
  } finally {
    carregando.value = false
  }
}

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const isValidPhone = (phone: string) => {
  const phoneDigits = phone.replace(/\D/g, '')
  return phoneDigits.length >= 10 && phoneDigits.length <= 11
}

const formatPhone = (value: string) => {
  const phoneDigits = value.replace(/\D/g, '')
  if (phoneDigits.length <= 2) {
    return phoneDigits
  }
  if (phoneDigits.length <= 7) {
    return `(${phoneDigits.slice(0, 2)}) ${phoneDigits.slice(2)}`
  }
  return `(${phoneDigits.slice(0, 2)}) ${phoneDigits.slice(2, 7)}-${phoneDigits.slice(7, 11)}`
}

const handlePhoneInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  telefone.value = formatPhone(input.value)
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
          <h1 class="text-2xl font-bold">Criar uma conta</h1>
          <p class="text-muted-foreground mt-2 text-sm">Preencha os dados abaixo para se registrar</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <BaseInput
            v-model="nomeUsuario"
            label="Nome de usuário"
            tipo="text"
            placeholder="seu_usuario"
            :erro="erros.nomeUsuario"
            autocomplete="username"
          />

          <BaseInput
            v-model="email"
            label="E-mail"
            tipo="text"
            placeholder="seu@email.com"
            :erro="erros.email"
            autocomplete="email"
          />

          <BaseInput
            v-model="telefone"
            label="Número de telefone"
            tipo="text"
            placeholder="(11) 99999-9999"
            :erro="erros.telefone"
            @input="handlePhoneInput"
            autocomplete="tel"
          />

          <BaseInput
            v-model="senha"
            label="Senha"
            tipo="password"
            placeholder="••••••••"
            :erro="erros.senha"
            autocomplete="new-password"
            dica="Mínimo 6 caracteres"
          />

          <BaseInput
            v-model="confirmarSenha"
            label="Confirmar senha"
            tipo="password"
            placeholder="••••••••"
            :erro="erros.confirmarSenha"
            autocomplete="new-password"
          />

          <BaseButton
            tipo="submit"
            :carregando="carregando"
            :desabilitado="carregando"
            blocoCompleto
          >
            Registrar
          </BaseButton>
        </form>

        <!-- Footer -->
        <div class="space-y-3 text-center text-sm">
          <p class="text-muted-foreground">
            Já tem uma conta?
            <RouterLink :to="{ name: 'login' }" class="text-primary hover:underline font-medium">
              Faça login
            </RouterLink>
          </p>

        </div>
      </div>
    </BaseCard>
  </div>
</template>
