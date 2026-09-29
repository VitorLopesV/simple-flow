import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ProfileModal from '@/components/features/ProfileModal.vue'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { resizeImage } from '@/utils/image'

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
vi.mock('@/services/authService', () => ({ authService: { updateProfile: vi.fn() } }))
vi.mock('@/utils/image', async (original) => ({
  ...(await original<typeof import('@/utils/image')>()),
  resizeImage: vi.fn(),
}))

const updateMock = vi.mocked(authService.updateProfile)
const resizeMock = vi.mocked(resizeImage)

const PHOTO = 'data:image/jpeg;base64,FOTO'

let wrapper: VueWrapper | undefined

/** Abre o modal já em modo edição por padrão; `editar = false` testa o modo leitura. */
async function mountComponent(user: Record<string, unknown> = {}, edit = true) {
  localStorage.clear()
  setActivePinia(createPinia())
  useAuthStore().setSession({
    user: { id: 'u1', email: 'ana@exemplo.com', name: 'Ana', phone: '11999998888', ...user },
    accessToken: 'a',
    refreshToken: 'r',
    expiresIn: 3600,
  })

  wrapper = mount(ProfileModal, {
    props: { open: false, 'onUpdate:open': (v: boolean) => wrapper?.setProps({ open: v }) },
    global: { stubs: { teleport: true } },
    attachTo: document.body,
  })
  await wrapper.setProps({ open: true })
  await flushPromises()
  if (edit) {
    await button(wrapper, 'Editar perfil')!.trigger('click')
    await flushPromises()
  }
  return wrapper
}

const field = (screen: VueWrapper, autocomplete: string) =>
  screen.get<HTMLInputElement>(`input[autocomplete="${autocomplete}"]`)

const button = (screen: VueWrapper, text: string) =>
  screen.findAll('button').find((b) => b.text().includes(text))

async function chooseFile(screen: VueWrapper, file: File) {
  const input = screen.get<HTMLInputElement>('[data-testid="photo-input"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

/** O vee-validate valida o schema com um debounce de alguns ms: `flushPromises` sozinho não espera. */
async function submit(screen: VueWrapper) {
  await screen.get('form').trigger('submit')
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

const image = (type = 'image/png') => new File([new Uint8Array(10)], 'photo', { type: type })

beforeEach(() => {
  updateMock.mockImplementation(async (payload) => ({ id: 'u1', ...payload }))
  resizeMock.mockResolvedValue(PHOTO)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('modo leitura', () => {
  it('abre exibindo nome, e-mail e telefone como texto, sem campos editáveis', async () => {
    const screen = await mountComponent({}, false)

    expect(screen.find('form').exists()).toBe(false)
    expect(screen.findAll('input[autocomplete]')).toHaveLength(0)
    expect(screen.text()).toContain('Ana')
    expect(screen.text()).toContain('ana@exemplo.com')
    expect(screen.text()).toContain('(11) 99999-8888')
    expect(button(screen, 'Editar perfil')).toBeTruthy()
    expect(button(screen, 'Salvar alterações')).toBeUndefined()
  })

  it('mostra "Não informado" para o que está vazio', async () => {
    const screen = await mountComponent({ name: null, phone: null }, false)

    expect(screen.text().match(/Não informado/g)).toHaveLength(2)
  })

  it('não oferece ações de foto até entrar em edição', async () => {
    const screen = await mountComponent({ photoUrl: PHOTO }, false)

    expect(screen.get('img').attributes('src')).toBe(PHOTO)
    expect(button(screen, 'Alterar foto')).toBeUndefined()
    expect(button(screen, 'Remover foto')).toBeUndefined()
  })

  it('"Editar perfil" libera os campos já preenchidos', async () => {
    const screen = await mountComponent({}, false)

    await button(screen, 'Editar perfil')!.trigger('click')

    expect(field(screen, 'name').element.value).toBe('Ana')
    expect(field(screen, 'email').element.value).toBe('ana@exemplo.com')
    expect(field(screen, 'tel').element.value).toBe('(11) 99999-8888')
    expect(button(screen, 'Salvar alterações')).toBeTruthy()
    expect(button(screen, 'Editar perfil')).toBeUndefined()
  })

  it('reabrir o modal volta ao modo leitura', async () => {
    const screen = await mountComponent()
    expect(screen.find('form').exists()).toBe(true)

    await screen.setProps({ open: false })
    await screen.setProps({ open: true })
    await flushPromises()

    expect(screen.find('form').exists()).toBe(false)
  })
})

describe('foto no modo edição', () => {
  it('sem foto, oferece "Adicionar foto" e não oferece remover', async () => {
    const screen = await mountComponent()

    expect(button(screen, 'Adicionar foto')).toBeTruthy()
    expect(button(screen, 'Remover foto')).toBeUndefined()
    expect(screen.find('img').exists()).toBe(false)
  })

  it('com foto, mostra a imagem e oferece "Alterar foto" e "Remover foto"', async () => {
    const screen = await mountComponent({ photoUrl: PHOTO })

    expect(screen.get('img').attributes('src')).toBe(PHOTO)
    expect(button(screen, 'Alterar foto')).toBeTruthy()
    expect(button(screen, 'Remover foto')).toBeTruthy()
  })
})

describe('edição de dados', () => {
  it('salva nome, e-mail e telefone editados (telefone só com dígitos) e volta ao modo leitura', async () => {
    const screen = await mountComponent()

    await field(screen, 'name').setValue('Ana Souza')
    await field(screen, 'email').setValue('ana.souza@exemplo.com')
    await field(screen, 'tel').setValue('11888887777')
    await submit(screen)

    expect(updateMock).toHaveBeenCalledWith({
      name: 'Ana Souza',
      email: 'ana.souza@exemplo.com',
      phone: '11888887777',
      photoUrl: null,
    })
    expect(useAuthStore().user).toMatchObject({ name: 'Ana Souza', email: 'ana.souza@exemplo.com' })
    expect(screen.props()['open' as never]).toBe(true)
    expect(screen.find('form').exists()).toBe(false)
    expect(screen.text()).toContain('ana.souza@exemplo.com')
  })

  it('aplica a máscara enquanto digita o telefone', async () => {
    const screen = await mountComponent()

    await field(screen, 'tel').setValue('1133334444')

    expect(field(screen, 'tel').element.value).toBe('(11) 3333-4444')
  })

  it('não salva com e-mail inválido ou nome vazio e mostra os erros', async () => {
    const screen = await mountComponent()

    await field(screen, 'name').setValue('')
    await field(screen, 'email').setValue('ruim')
    await submit(screen)

    expect(screen.findAll('[role="alert"]').map((a) => a.text())).toEqual([
      'Nome é obrigatório.',
      'E-mail inválido.',
    ])
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('continua em edição e não altera o usuário quando o salvamento falha', async () => {
    updateMock.mockRejectedValue(new Error('falhou'))
    const screen = await mountComponent()

    await field(screen, 'name').setValue('Outro Nome')
    await submit(screen)

    expect(screen.find('form').exists()).toBe(true)
    expect(useAuthStore().user?.name).toBe('Ana')
  })

  it('cancelar descarta as edições e volta ao modo leitura com os dados salvos', async () => {
    const screen = await mountComponent()

    await field(screen, 'name').setValue('Rascunho')
    await button(screen, 'Cancelar')!.trigger('click')

    expect(screen.find('form').exists()).toBe(false)
    expect(screen.text()).toContain('Ana')
    expect(screen.text()).not.toContain('Rascunho')

    await button(screen, 'Editar perfil')!.trigger('click')
    expect(field(screen, 'name').element.value).toBe('Ana')
  })
})

describe('foto de perfil', () => {
  it('adicionar: mostra a prévia, avisa que só vale ao salvar e envia a foto', async () => {
    const screen = await mountComponent()

    await chooseFile(screen, image())

    expect(screen.get('img').attributes('src')).toBe(PHOTO)
    expect(screen.text()).toContain('Nova foto selecionada')
    expect(button(screen, 'Alterar foto')).toBeTruthy()

    await submit(screen)

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: PHOTO }))
    expect(useAuthStore().user?.photoUrl).toBe(PHOTO)
  })

  it('alterar: substitui a foto existente', async () => {
    resizeMock.mockResolvedValue('data:image/jpeg;base64,NOVA')
    const screen = await mountComponent({ photoUrl: PHOTO })

    await chooseFile(screen, image('image/webp'))
    await submit(screen)

    expect(useAuthStore().user?.photoUrl).toBe('data:image/jpeg;base64,NOVA')
  })

  it('remover: tira a prévia, avisa e envia photoUrl null ao salvar', async () => {
    const screen = await mountComponent({ photoUrl: PHOTO })

    await button(screen, 'Remover foto')!.trigger('click')

    expect(screen.find('img').exists()).toBe(false)
    expect(screen.text()).toContain('A foto será removida')
    expect(button(screen, 'Adicionar foto')).toBeTruthy()

    await submit(screen)

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: null }))
    expect(useAuthStore().user?.photoUrl).toBeNull()
  })

  it('rejeita arquivo que não é imagem aceita, sem alterar a foto', async () => {
    const screen = await mountComponent()

    await chooseFile(screen, image('application/pdf'))

    expect(screen.text()).toContain('Use uma imagem JPG, PNG ou WebP.')
    expect(screen.find('img').exists()).toBe(false)
    expect(resizeMock).not.toHaveBeenCalled()
  })

  it('mostra erro quando a imagem não pode ser lida', async () => {
    resizeMock.mockRejectedValue(new Error('corrompida'))
    const screen = await mountComponent()

    await chooseFile(screen, image())

    expect(screen.text()).toContain('Não foi possível ler essa imagem')
    expect(screen.find('img').exists()).toBe(false)
  })

  it('cancelar descarta uma foto escolhida e não salva', async () => {
    const screen = await mountComponent()
    await chooseFile(screen, image())

    await button(screen, 'Cancelar')!.trigger('click')

    expect(screen.find('img').exists()).toBe(false)
    expect(updateMock).not.toHaveBeenCalled()
  })
})
