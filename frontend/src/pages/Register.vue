<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import AuthBrand from '@/components/features/AuthBrand.vue'
import { authService } from '@/services/authService'
import { getErrorMessage } from '@/services/http'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errors = ref<Record<string, string>>({})

const handleSubmit = async () => {
  errors.value = {}

  if (!username.value) {
    errors.value.username = 'Nome de usuário é obrigatório'
  } else if (username.value.length < 3) {
    errors.value.username = 'Nome de usuário deve ter no mínimo 3 caracteres'
  }

  if (!email.value) {
    errors.value.email = 'E-mail é obrigatório'
  } else if (!isValidEmail(email.value)) {
    errors.value.email = 'E-mail inválido'
  }

  if (!phone.value) {
    errors.value.phone = 'Número de telefone é obrigatório'
  } else if (!isValidPhone(phone.value)) {
    errors.value.phone = 'Número de telefone inválido'
  }

  if (!password.value) {
    errors.value.password = 'Senha é obrigatória'
  } else if (password.value.length < 6) {
    errors.value.password = 'Senha deve ter no mínimo 6 caracteres'
  }

  if (!confirmPassword.value) {
    errors.value.confirmPassword = 'Confirmação de senha é obrigatória'
  } else if (password.value !== confirmPassword.value) {
    errors.value.confirmPassword = 'As senhas não coincidem'
  }

  if (Object.keys(errors.value).length > 0) {
    return
  }

  loading.value = true

  try {
    // Telefone é validado no formulário, mas ainda não é persistido pelo backend
    // (a tabela profiles só guarda nome) — fica como possível melhoria futura.
    const session = await authService.register({
      email: email.value,
      password: password.value,
      name: username.value,
    })
    authStore.setSession(session)

    toast.success('Cadastro realizado com sucesso!')
    await router.push({ name: 'dashboard' })
  } catch (error) {
    toast.error(getErrorMessage(error, 'Erro ao registrar. Tente novamente.'))
  } finally {
    loading.value = false
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
  phone.value = formatPhone(input.value)
}
</script>

<template>
  <div class="w-full max-w-md">
    <!-- No mobile o painel da marca some (ver AuthLayout): a marca fica acima do card. -->
    <AuthBrand class="mb-6 lg:hidden" />

    <BaseCard class="border shadow-lg">
      <div class="space-y-6">
        <!-- Header -->
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Criar uma conta</h1>
          <p class="text-muted-foreground mt-2 text-sm">Preencha os dados abaixo para se registrar</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <BaseInput
            v-model="username"
            label="Nome de usuário"
            type="text"
            placeholder="seu_usuario"
            :error="errors.username"
            autocomplete="username"
          />

          <BaseInput
            v-model="email"
            label="E-mail"
            type="text"
            placeholder="seu@email.com"
            :error="errors.email"
            autocomplete="email"
          />

          <BaseInput
            v-model="phone"
            label="Número de telefone"
            type="text"
            placeholder="(11) 99999-9999"
            :error="errors.phone"
            @input="handlePhoneInput"
            autocomplete="tel"
          />

          <BaseInput
            v-model="password"
            label="Senha"
            type="password"
            placeholder="••••••••"
            :error="errors.password"
            autocomplete="new-password"
            hint="Mínimo 6 caracteres"
          />

          <BaseInput
            v-model="confirmPassword"
            label="Confirmar senha"
            type="password"
            placeholder="••••••••"
            :error="errors.confirmPassword"
            autocomplete="new-password"
          />

          <BaseButton
            type="submit"
            variant="success"
            size="lg"
            :loading="loading"
            :disabled="loading"
            full-width
          >
            Registrar
          </BaseButton>
        </form>

        <!-- Footer -->
        <div class="border-border border-t pt-5 text-center text-sm">
          <p class="text-muted-foreground">
            Já tem uma conta?
            <RouterLink :to="{ name: 'login' }" class="text-success hover:underline font-semibold">
              Faça login
            </RouterLink>
          </p>
        </div>
      </div>
    </BaseCard>
  </div>
</template>
