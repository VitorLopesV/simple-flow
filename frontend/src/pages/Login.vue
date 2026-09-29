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

const email = ref('')
const password = ref('')
const loading = ref(false)
const errors = ref<Record<string, string>>({})

const handleSubmit = async () => {
  errors.value = {}

  if (!email.value) {
    errors.value.email = 'E-mail é obrigatório'
  } else if (!isValidEmail(email.value)) {
    errors.value.email = 'E-mail inválido'
  }

  if (!password.value) {
    errors.value.password = 'Senha é obrigatória'
  } else if (password.value.length < 6) {
    errors.value.password = 'Senha deve ter no mínimo 6 caracteres'
  }

  if (Object.keys(errors.value).length > 0) {
    return
  }

  loading.value = true

  try {
    const session = await authService.login({ email: email.value, password: password.value })
    authStore.setSession(session)

    toast.success('Login realizado com sucesso!')
    await router.push({ name: 'dashboard' })
  } catch (error) {
    toast.error(getErrorMessage(error, 'Erro ao fazer login. Verifique seus dados.'))
  } finally {
    loading.value = false
  }
}

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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
          <h1 class="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
          <p class="text-muted-foreground mt-2 text-sm">Faça login na sua conta para continuar</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <BaseInput
            v-model="email"
            label="E-mail"
            type="text"
            placeholder="seu@email.com"
            :error="errors.email"
            autocomplete="email"
          />

          <BaseInput
            v-model="password"
            label="Senha"
            type="password"
            placeholder="••••••••"
            :error="errors.password"
            autocomplete="current-password"
          />

          <BaseButton
            type="submit"
            variant="success"
            size="lg"
            :loading="loading"
            :disabled="loading"
            full-width
          >
            Entrar
          </BaseButton>
        </form>

        <!-- Footer -->
        <div class="border-border border-t pt-5 text-center text-sm">
          <p class="text-muted-foreground">
            Não tem uma conta?
            <RouterLink :to="{ name: 'register' }" class="text-success hover:underline font-semibold">
              Registre-se aqui
            </RouterLink>
          </p>
        </div>
      </div>
    </BaseCard>
  </div>
</template>
