<script setup lang="ts">
import { Camera, Pencil, Trash2 } from '@lucide/vue'
import { useField, useForm } from 'vee-validate'
import { computed, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import UserAvatar from '@/components/features/UserAvatar.vue'
import { notify } from '@/composables/useNotify'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'
import { ACCEPTED_IMAGE_TYPES, resizeImage, validateImageFile } from '@/utils/image'
import { formatPhone } from '@/utils/phoneFormatter'
import {
  compose,
  maxLength,
  minLength,
  optionalPhone,
  required,
  validEmail,
} from '@/utils/validators'

interface FormValues {
  name: string
  email: string
  phone: string
}

const open = defineModel<boolean>('open', { default: false })

const authStore = useAuthStore()
const profileStore = useProfileStore()

const FORM_ID = 'profile-form'

function initialValues(): FormValues {
  return {
    name: authStore.user?.name ?? '',
    email: authStore.user?.email ?? '',
    phone: formatPhone(authStore.user?.phone ?? ''),
  }
}

const { handleSubmit, resetForm } = useForm<FormValues>({
  initialValues: initialValues(),
  validationSchema: {
    name: compose(required('Nome'), minLength(2, 'Nome'), maxLength(60, 'Nome')),
    email: compose(required('E-mail'), validEmail()),
    phone: optionalPhone(),
  },
})

const { value: name, errorMessage: nameError } = useField<string>('name')
const { value: email, errorMessage: emailError } = useField<string>('email')
const { value: phone, errorMessage: phoneError } = useField<string>('phone')

/** O modal abre só para leitura; os campos ficam editáveis depois de "Editar perfil". */
const editing = ref(false)

/** Foto em edição: só vai para o usuário ao salvar. `null` = sem foto. */
const photo = ref<string | null>(authStore.user?.photoUrl ?? null)
const photoError = ref('')
const processingPhoto = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const currentPhoto = computed(() => authStore.user?.photoUrl ?? null)
const photoChanged = computed(() => photo.value !== currentPhoto.value)

/** Diz ao usuário o que vai acontecer com a foto, já que ela só é aplicada ao salvar. */
const photoNotice = computed(() => {
  if (!photoChanged.value) return ''
  return photo.value
    ? 'Nova foto selecionada. Clique em “Salvar alterações” para aplicar.'
    : 'A foto será removida quando você salvar as alterações.'
})

/** Volta o formulário e a foto aos dados salvos, descartando o que não foi salvo. */
function discardChanges(): void {
  resetForm({ values: initialValues() })
  photo.value = currentPhoto.value
  photoError.value = ''
}

// A cada abertura o modal volta ao modo leitura, com os dados salvos.
watch(open, (isOpen) => {
  if (!isOpen) return
  editing.value = false
  discardChanges()
})

function startEditing(): void {
  editing.value = true
}

function cancelEditing(): void {
  discardChanges()
  editing.value = false
}

function chooseFile(): void {
  fileInput.value?.click()
}

async function onFileChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Permite escolher o mesmo arquivo de novo depois de removê-lo.
  input.value = ''
  if (!file) return

  photoError.value = validateImageFile(file) ?? ''
  if (photoError.value) return

  processingPhoto.value = true
  try {
    photo.value = await resizeImage(file)
  } catch {
    photoError.value = 'Não foi possível ler essa imagem. Tente outro arquivo.'
  } finally {
    processingPhoto.value = false
  }
}

function removePhoto(): void {
  photo.value = null
  photoError.value = ''
}

function onPhoneInput(event: Event): void {
  phone.value = formatPhone((event.target as HTMLInputElement).value)
}

const onSubmit = handleSubmit(async (form) => {
  const saved = await profileStore.save({
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.replace(/\D/g, '') || null,
    photoUrl: photo.value,
  })

  if (!saved) {
    notify.error(profileStore.error ?? 'Não foi possível salvar o perfil.')
    return
  }

  notify.success('Perfil atualizado')
  editing.value = false
})

const displayedData = computed(() => [
  { label: 'Nome', value: authStore.user?.name ?? '' },
  { label: 'E-mail', value: authStore.user?.email ?? '' },
  { label: 'Número de telefone', value: formatPhone(authStore.user?.phone ?? '') },
])
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Meu perfil"
    :description="editing ? 'Edite seus dados pessoais.' : 'Seus dados pessoais.'"
  >
    <div class="flex flex-col gap-5">
      <!-- Foto de perfil -->
      <div class="flex items-center gap-4">
        <UserAvatar :photo-url="editing ? photo : currentPhoto" class="size-20" />

        <div v-if="editing" class="flex min-w-0 flex-col items-start gap-2">
          <div class="flex flex-wrap gap-2">
            <BaseButton
              variant="outline"
              size="sm"
              :loading="processingPhoto"
              @click="chooseFile"
            >
              <Camera class="size-4" aria-hidden="true" />
              {{ photo ? 'Alterar foto' : 'Adicionar foto' }}
            </BaseButton>
            <BaseButton v-if="photo" variant="ghost" size="sm" @click="removePhoto">
              <Trash2 class="text-danger size-4" aria-hidden="true" />
              Remover foto
            </BaseButton>
          </div>

          <p v-if="photoError" class="text-danger text-xs" role="alert">{{ photoError }}</p>
          <p v-else-if="photoNotice" class="text-muted-foreground text-xs" role="status">
            {{ photoNotice }}
          </p>
          <p v-else class="text-muted-foreground text-xs">JPG, PNG ou WebP, até 5 MB.</p>
        </div>

        <div v-else class="min-w-0">
          <p class="truncate text-base font-semibold">
            {{ authStore.user?.name || 'Sem nome' }}
          </p>
          <p class="text-muted-foreground truncate text-sm">{{ authStore.user?.email }}</p>
        </div>
      </div>

      <!-- Modo leitura -->
      <dl v-if="!editing" class="divide-border border-border divide-y rounded-lg border">
        <div
          v-for="entry in displayedData"
          :key="entry.label"
          class="flex items-center justify-between gap-4 px-4 py-3"
        >
          <dt class="text-muted-foreground text-sm">{{ entry.label }}</dt>
          <dd class="min-w-0 truncate text-sm font-medium">
            <template v-if="entry.value">{{ entry.value }}</template>
            <span v-else class="text-muted-foreground font-normal">Não informado</span>
          </dd>
        </div>
      </dl>

      <form
        v-else
        :id="FORM_ID"
        class="flex flex-col gap-4"
        novalidate
        @submit="onSubmit"
      >
        <BaseInput
          v-model="name"
          label="Nome"
          placeholder="Seu nome"
          :error="nameError"
          required
          :maxlength="60"
          autocomplete="name"
        >
          <template #suffix>
            <Pencil class="text-muted-foreground mr-2 size-3.5" aria-hidden="true" />
          </template>
        </BaseInput>

        <BaseInput
          v-model="email"
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          :error="emailError"
          required
          autocomplete="email"
        >
          <template #suffix>
            <Pencil class="text-muted-foreground mr-2 size-3.5" aria-hidden="true" />
          </template>
        </BaseInput>

        <BaseInput
          v-model="phone"
          label="Número de telefone"
          type="tel"
          inputmode="numeric"
          placeholder="(11) 99999-9999"
          :error="phoneError"
          autocomplete="tel"
          @input="onPhoneInput"
        >
          <template #suffix>
            <Pencil class="text-muted-foreground mr-2 size-3.5" aria-hidden="true" />
          </template>
        </BaseInput>
      </form>

      <!-- Depois dos campos: o modal foca o primeiro input, e este não deve ser ele. -->
      <input
        ref="fileInput"
        type="file"
        :accept="ACCEPTED_IMAGE_TYPES.join(',')"
        class="hidden"
        data-testid="photo-input"
        @change="onFileChosen"
      />
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <template v-if="editing">
          <BaseButton variant="outline" @click="cancelEditing">Cancelar</BaseButton>
          <BaseButton
            type="submit"
            variant="success"
            :form="FORM_ID"
            :loading="profileStore.saving"
          >
            Salvar alterações
          </BaseButton>
        </template>
        <BaseButton v-else variant="success" @click="startEditing">
          <Pencil class="size-4" aria-hidden="true" />
          Editar perfil
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
