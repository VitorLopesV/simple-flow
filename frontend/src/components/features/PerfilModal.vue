<script setup lang="ts">
import { Camera, Pencil, Trash2 } from '@lucide/vue'
import { useField, useForm } from 'vee-validate'
import { computed, ref, watch } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import UsuarioAvatar from '@/components/features/UsuarioAvatar.vue'
import { notificar } from '@/composables/useNotify'
import { useAuthStore } from '@/stores/authStore'
import { usePerfilStore } from '@/stores/perfilStore'
import { redimensionarImagem, TIPOS_IMAGEM_ACEITOS, validarArquivoImagem } from '@/utils/imagem'
import { formatarTelefone } from '@/utils/telefoneFormatter'
import {
  compor,
  emailValido,
  maximoCaracteres,
  minimoCaracteres,
  obrigatorio,
  telefoneOpcional,
} from '@/utils/validators'

interface Valores {
  nome: string
  email: string
  telefone: string
}

const aberto = defineModel<boolean>('aberto', { default: false })

const authStore = useAuthStore()
const perfilStore = usePerfilStore()

const ID_FORMULARIO = 'form-perfil'

function valoresIniciais(): Valores {
  return {
    nome: authStore.usuario?.nome ?? '',
    email: authStore.usuario?.email ?? '',
    telefone: formatarTelefone(authStore.usuario?.telefone ?? ''),
  }
}

const { handleSubmit, resetForm } = useForm<Valores>({
  initialValues: valoresIniciais(),
  validationSchema: {
    nome: compor(obrigatorio('Nome'), minimoCaracteres(2, 'Nome'), maximoCaracteres(60, 'Nome')),
    email: compor(obrigatorio('E-mail'), emailValido()),
    telefone: telefoneOpcional(),
  },
})

const { value: nome, errorMessage: erroNome } = useField<string>('nome')
const { value: email, errorMessage: erroEmail } = useField<string>('email')
const { value: telefone, errorMessage: erroTelefone } = useField<string>('telefone')

/** O modal abre só para leitura; os campos ficam editáveis depois de "Editar perfil". */
const editando = ref(false)

/** Foto em edição: só vai para o usuário ao salvar. `null` = sem foto. */
const foto = ref<string | null>(authStore.usuario?.fotoUrl ?? null)
const erroFoto = ref('')
const processandoFoto = ref(false)
const seletorArquivo = ref<HTMLInputElement | null>(null)

const fotoAtual = computed(() => authStore.usuario?.fotoUrl ?? null)
const fotoMudou = computed(() => foto.value !== fotoAtual.value)

/** Diz ao usuário o que vai acontecer com a foto, já que ela só é aplicada ao salvar. */
const avisoFoto = computed(() => {
  if (!fotoMudou.value) return ''
  return foto.value
    ? 'Nova foto selecionada. Clique em “Salvar alterações” para aplicar.'
    : 'A foto será removida quando você salvar as alterações.'
})

/** Volta o formulário e a foto aos dados salvos, descartando o que não foi salvo. */
function descartarEdicao(): void {
  resetForm({ values: valoresIniciais() })
  foto.value = fotoAtual.value
  erroFoto.value = ''
}

// A cada abertura o modal volta ao modo leitura, com os dados salvos.
watch(aberto, (estaAberto) => {
  if (!estaAberto) return
  editando.value = false
  descartarEdicao()
})

function iniciarEdicao(): void {
  editando.value = true
}

function cancelarEdicao(): void {
  descartarEdicao()
  editando.value = false
}

function escolherArquivo(): void {
  seletorArquivo.value?.click()
}

async function aoEscolherArquivo(evento: Event): Promise<void> {
  const campo = evento.target as HTMLInputElement
  const arquivo = campo.files?.[0]
  // Permite escolher o mesmo arquivo de novo depois de removê-lo.
  campo.value = ''
  if (!arquivo) return

  erroFoto.value = validarArquivoImagem(arquivo) ?? ''
  if (erroFoto.value) return

  processandoFoto.value = true
  try {
    foto.value = await redimensionarImagem(arquivo)
  } catch {
    erroFoto.value = 'Não foi possível ler essa imagem. Tente outro arquivo.'
  } finally {
    processandoFoto.value = false
  }
}

function removerFoto(): void {
  foto.value = null
  erroFoto.value = ''
}

function aoDigitarTelefone(evento: Event): void {
  telefone.value = formatarTelefone((evento.target as HTMLInputElement).value)
}

const aoSubmeter = handleSubmit(async (formulario) => {
  const salvou = await perfilStore.salvar({
    nome: formulario.nome.trim(),
    email: formulario.email.trim(),
    telefone: formulario.telefone.replace(/\D/g, '') || null,
    fotoUrl: foto.value,
  })

  if (!salvou) {
    notificar.erro(perfilStore.erro ?? 'Não foi possível salvar o perfil.')
    return
  }

  notificar.sucesso('Perfil atualizado')
  editando.value = false
})

const dadosExibidos = computed(() => [
  { rotulo: 'Nome', valor: authStore.usuario?.nome ?? '' },
  { rotulo: 'E-mail', valor: authStore.usuario?.email ?? '' },
  { rotulo: 'Número de telefone', valor: formatarTelefone(authStore.usuario?.telefone ?? '') },
])
</script>

<template>
  <BaseModal
    v-model:aberto="aberto"
    titulo="Meu perfil"
    :descricao="editando ? 'Edite seus dados pessoais.' : 'Seus dados pessoais.'"
  >
    <div class="flex flex-col gap-5">
      <!-- Foto de perfil -->
      <div class="flex items-center gap-4">
        <UsuarioAvatar :foto-url="editando ? foto : fotoAtual" class="size-20" />

        <div v-if="editando" class="flex min-w-0 flex-col items-start gap-2">
          <div class="flex flex-wrap gap-2">
            <BaseButton
              variante="outline"
              tamanho="sm"
              :carregando="processandoFoto"
              @click="escolherArquivo"
            >
              <Camera class="size-4" aria-hidden="true" />
              {{ foto ? 'Alterar foto' : 'Adicionar foto' }}
            </BaseButton>
            <BaseButton v-if="foto" variante="ghost" tamanho="sm" @click="removerFoto">
              <Trash2 class="text-danger size-4" aria-hidden="true" />
              Remover foto
            </BaseButton>
          </div>

          <p v-if="erroFoto" class="text-danger text-xs" role="alert">{{ erroFoto }}</p>
          <p v-else-if="avisoFoto" class="text-muted-foreground text-xs" role="status">
            {{ avisoFoto }}
          </p>
          <p v-else class="text-muted-foreground text-xs">JPG, PNG ou WebP, até 5 MB.</p>
        </div>

        <div v-else class="min-w-0">
          <p class="truncate text-base font-semibold">
            {{ authStore.usuario?.nome || 'Sem nome' }}
          </p>
          <p class="text-muted-foreground truncate text-sm">{{ authStore.usuario?.email }}</p>
        </div>
      </div>

      <!-- Modo leitura -->
      <dl v-if="!editando" class="divide-border border-border divide-y rounded-lg border">
        <div
          v-for="dado in dadosExibidos"
          :key="dado.rotulo"
          class="flex items-center justify-between gap-4 px-4 py-3"
        >
          <dt class="text-muted-foreground text-sm">{{ dado.rotulo }}</dt>
          <dd class="min-w-0 truncate text-sm font-medium">
            <template v-if="dado.valor">{{ dado.valor }}</template>
            <span v-else class="text-muted-foreground font-normal">Não informado</span>
          </dd>
        </div>
      </dl>

      <form
        v-else
        :id="ID_FORMULARIO"
        class="flex flex-col gap-4"
        novalidate
        @submit="aoSubmeter"
      >
        <BaseInput
          v-model="nome"
          label="Nome"
          placeholder="Seu nome"
          :erro="erroNome"
          obrigatorio
          :maxlength="60"
          autocomplete="name"
        >
          <template #sufixo>
            <Pencil class="text-muted-foreground mr-2 size-3.5" aria-hidden="true" />
          </template>
        </BaseInput>

        <BaseInput
          v-model="email"
          label="E-mail"
          tipo="email"
          placeholder="seu@email.com"
          :erro="erroEmail"
          obrigatorio
          autocomplete="email"
        >
          <template #sufixo>
            <Pencil class="text-muted-foreground mr-2 size-3.5" aria-hidden="true" />
          </template>
        </BaseInput>

        <BaseInput
          v-model="telefone"
          label="Número de telefone"
          tipo="tel"
          inputmode="numeric"
          placeholder="(11) 99999-9999"
          :erro="erroTelefone"
          autocomplete="tel"
          @input="aoDigitarTelefone"
        >
          <template #sufixo>
            <Pencil class="text-muted-foreground mr-2 size-3.5" aria-hidden="true" />
          </template>
        </BaseInput>
      </form>

      <!-- Depois dos campos: o modal foca o primeiro input, e este não deve ser ele. -->
      <input
        ref="seletorArquivo"
        type="file"
        :accept="TIPOS_IMAGEM_ACEITOS.join(',')"
        class="hidden"
        data-testid="seletor-foto"
        @change="aoEscolherArquivo"
      />
    </div>

    <template #rodape>
      <div class="flex justify-end gap-2">
        <template v-if="editando">
          <BaseButton variante="outline" @click="cancelarEdicao">Cancelar</BaseButton>
          <BaseButton
            tipo="submit"
            variante="success"
            :form="ID_FORMULARIO"
            :carregando="perfilStore.salvando"
          >
            Salvar alterações
          </BaseButton>
        </template>
        <BaseButton v-else variante="success" @click="iniciarEdicao">
          <Pencil class="size-4" aria-hidden="true" />
          Editar perfil
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
