import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PerfilModal from '@/components/features/PerfilModal.vue'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { redimensionarImagem } from '@/utils/imagem'

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
vi.mock('@/services/authService', () => ({ authService: { atualizarPerfil: vi.fn() } }))
vi.mock('@/utils/imagem', async (original) => ({
  ...(await original<typeof import('@/utils/imagem')>()),
  redimensionarImagem: vi.fn(),
}))

const atualizarMock = vi.mocked(authService.atualizarPerfil)
const redimensionarMock = vi.mocked(redimensionarImagem)

const FOTO = 'data:image/jpeg;base64,FOTO'

let wrapper: VueWrapper | undefined

/** Abre o modal já em modo edição por padrão; `editar = false` testa o modo leitura. */
async function montar(usuario: Record<string, unknown> = {}, editar = true) {
  localStorage.clear()
  setActivePinia(createPinia())
  useAuthStore().definirSessao({
    usuario: { id: 'u1', email: 'ana@exemplo.com', nome: 'Ana', telefone: '11999998888', ...usuario },
    accessToken: 'a',
    refreshToken: 'r',
    expiresIn: 3600,
  })

  wrapper = mount(PerfilModal, {
    props: { aberto: false, 'onUpdate:aberto': (v: boolean) => wrapper?.setProps({ aberto: v }) },
    global: { stubs: { teleport: true } },
    attachTo: document.body,
  })
  await wrapper.setProps({ aberto: true })
  await flushPromises()
  if (editar) {
    await botao(wrapper, 'Editar perfil')!.trigger('click')
    await flushPromises()
  }
  return wrapper
}

const campo = (tela: VueWrapper, autocomplete: string) =>
  tela.get<HTMLInputElement>(`input[autocomplete="${autocomplete}"]`)

const botao = (tela: VueWrapper, texto: string) =>
  tela.findAll('button').find((b) => b.text().includes(texto))

async function escolherArquivo(tela: VueWrapper, arquivo: File) {
  const input = tela.get<HTMLInputElement>('[data-testid="seletor-foto"]')
  Object.defineProperty(input.element, 'files', { value: [arquivo], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

/** O vee-validate valida o schema com um debounce de alguns ms: `flushPromises` sozinho não espera. */
async function enviar(tela: VueWrapper) {
  await tela.get('form').trigger('submit')
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

const imagem = (tipo = 'image/png') => new File([new Uint8Array(10)], 'foto', { type: tipo })

beforeEach(() => {
  atualizarMock.mockImplementation(async (payload) => ({ id: 'u1', ...payload }))
  redimensionarMock.mockResolvedValue(FOTO)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('modo leitura', () => {
  it('abre exibindo nome, e-mail e telefone como texto, sem campos editáveis', async () => {
    const tela = await montar({}, false)

    expect(tela.find('form').exists()).toBe(false)
    expect(tela.findAll('input[autocomplete]')).toHaveLength(0)
    expect(tela.text()).toContain('Ana')
    expect(tela.text()).toContain('ana@exemplo.com')
    expect(tela.text()).toContain('(11) 99999-8888')
    expect(botao(tela, 'Editar perfil')).toBeTruthy()
    expect(botao(tela, 'Salvar alterações')).toBeUndefined()
  })

  it('mostra "Não informado" para o que está vazio', async () => {
    const tela = await montar({ nome: null, telefone: null }, false)

    expect(tela.text().match(/Não informado/g)).toHaveLength(2)
  })

  it('não oferece ações de foto até entrar em edição', async () => {
    const tela = await montar({ fotoUrl: FOTO }, false)

    expect(tela.get('img').attributes('src')).toBe(FOTO)
    expect(botao(tela, 'Alterar foto')).toBeUndefined()
    expect(botao(tela, 'Remover foto')).toBeUndefined()
  })

  it('"Editar perfil" libera os campos já preenchidos', async () => {
    const tela = await montar({}, false)

    await botao(tela, 'Editar perfil')!.trigger('click')

    expect(campo(tela, 'name').element.value).toBe('Ana')
    expect(campo(tela, 'email').element.value).toBe('ana@exemplo.com')
    expect(campo(tela, 'tel').element.value).toBe('(11) 99999-8888')
    expect(botao(tela, 'Salvar alterações')).toBeTruthy()
    expect(botao(tela, 'Editar perfil')).toBeUndefined()
  })

  it('reabrir o modal volta ao modo leitura', async () => {
    const tela = await montar()
    expect(tela.find('form').exists()).toBe(true)

    await tela.setProps({ aberto: false })
    await tela.setProps({ aberto: true })
    await flushPromises()

    expect(tela.find('form').exists()).toBe(false)
  })
})

describe('foto no modo edição', () => {
  it('sem foto, oferece "Adicionar foto" e não oferece remover', async () => {
    const tela = await montar()

    expect(botao(tela, 'Adicionar foto')).toBeTruthy()
    expect(botao(tela, 'Remover foto')).toBeUndefined()
    expect(tela.find('img').exists()).toBe(false)
  })

  it('com foto, mostra a imagem e oferece "Alterar foto" e "Remover foto"', async () => {
    const tela = await montar({ fotoUrl: FOTO })

    expect(tela.get('img').attributes('src')).toBe(FOTO)
    expect(botao(tela, 'Alterar foto')).toBeTruthy()
    expect(botao(tela, 'Remover foto')).toBeTruthy()
  })
})

describe('edição de dados', () => {
  it('salva nome, e-mail e telefone editados (telefone só com dígitos) e volta ao modo leitura', async () => {
    const tela = await montar()

    await campo(tela, 'name').setValue('Ana Souza')
    await campo(tela, 'email').setValue('ana.souza@exemplo.com')
    await campo(tela, 'tel').setValue('11888887777')
    await enviar(tela)

    expect(atualizarMock).toHaveBeenCalledWith({
      nome: 'Ana Souza',
      email: 'ana.souza@exemplo.com',
      telefone: '11888887777',
      fotoUrl: null,
    })
    expect(useAuthStore().usuario).toMatchObject({ nome: 'Ana Souza', email: 'ana.souza@exemplo.com' })
    expect(tela.props()['aberto' as never]).toBe(true)
    expect(tela.find('form').exists()).toBe(false)
    expect(tela.text()).toContain('ana.souza@exemplo.com')
  })

  it('aplica a máscara enquanto digita o telefone', async () => {
    const tela = await montar()

    await campo(tela, 'tel').setValue('1133334444')

    expect(campo(tela, 'tel').element.value).toBe('(11) 3333-4444')
  })

  it('não salva com e-mail inválido ou nome vazio e mostra os erros', async () => {
    const tela = await montar()

    await campo(tela, 'name').setValue('')
    await campo(tela, 'email').setValue('ruim')
    await enviar(tela)

    expect(tela.findAll('[role="alert"]').map((a) => a.text())).toEqual([
      'Nome é obrigatório.',
      'E-mail inválido.',
    ])
    expect(atualizarMock).not.toHaveBeenCalled()
  })

  it('continua em edição e não altera o usuário quando o salvamento falha', async () => {
    atualizarMock.mockRejectedValue(new Error('falhou'))
    const tela = await montar()

    await campo(tela, 'name').setValue('Outro Nome')
    await enviar(tela)

    expect(tela.find('form').exists()).toBe(true)
    expect(useAuthStore().usuario?.nome).toBe('Ana')
  })

  it('cancelar descarta as edições e volta ao modo leitura com os dados salvos', async () => {
    const tela = await montar()

    await campo(tela, 'name').setValue('Rascunho')
    await botao(tela, 'Cancelar')!.trigger('click')

    expect(tela.find('form').exists()).toBe(false)
    expect(tela.text()).toContain('Ana')
    expect(tela.text()).not.toContain('Rascunho')

    await botao(tela, 'Editar perfil')!.trigger('click')
    expect(campo(tela, 'name').element.value).toBe('Ana')
  })
})

describe('foto de perfil', () => {
  it('adicionar: mostra a prévia, avisa que só vale ao salvar e envia a foto', async () => {
    const tela = await montar()

    await escolherArquivo(tela, imagem())

    expect(tela.get('img').attributes('src')).toBe(FOTO)
    expect(tela.text()).toContain('Nova foto selecionada')
    expect(botao(tela, 'Alterar foto')).toBeTruthy()

    await enviar(tela)

    expect(atualizarMock).toHaveBeenCalledWith(expect.objectContaining({ fotoUrl: FOTO }))
    expect(useAuthStore().usuario?.fotoUrl).toBe(FOTO)
  })

  it('alterar: substitui a foto existente', async () => {
    redimensionarMock.mockResolvedValue('data:image/jpeg;base64,NOVA')
    const tela = await montar({ fotoUrl: FOTO })

    await escolherArquivo(tela, imagem('image/webp'))
    await enviar(tela)

    expect(useAuthStore().usuario?.fotoUrl).toBe('data:image/jpeg;base64,NOVA')
  })

  it('remover: tira a prévia, avisa e envia fotoUrl null ao salvar', async () => {
    const tela = await montar({ fotoUrl: FOTO })

    await botao(tela, 'Remover foto')!.trigger('click')

    expect(tela.find('img').exists()).toBe(false)
    expect(tela.text()).toContain('A foto será removida')
    expect(botao(tela, 'Adicionar foto')).toBeTruthy()

    await enviar(tela)

    expect(atualizarMock).toHaveBeenCalledWith(expect.objectContaining({ fotoUrl: null }))
    expect(useAuthStore().usuario?.fotoUrl).toBeNull()
  })

  it('rejeita arquivo que não é imagem aceita, sem alterar a foto', async () => {
    const tela = await montar()

    await escolherArquivo(tela, imagem('application/pdf'))

    expect(tela.text()).toContain('Use uma imagem JPG, PNG ou WebP.')
    expect(tela.find('img').exists()).toBe(false)
    expect(redimensionarMock).not.toHaveBeenCalled()
  })

  it('mostra erro quando a imagem não pode ser lida', async () => {
    redimensionarMock.mockRejectedValue(new Error('corrompida'))
    const tela = await montar()

    await escolherArquivo(tela, imagem())

    expect(tela.text()).toContain('Não foi possível ler essa imagem')
    expect(tela.find('img').exists()).toBe(false)
  })

  it('cancelar descarta uma foto escolhida e não salva', async () => {
    const tela = await montar()
    await escolherArquivo(tela, imagem())

    await botao(tela, 'Cancelar')!.trigger('click')

    expect(tela.find('img').exists()).toBe(false)
    expect(atualizarMock).not.toHaveBeenCalled()
  })
})
