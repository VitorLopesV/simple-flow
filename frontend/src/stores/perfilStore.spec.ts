import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { usePerfilStore } from '@/stores/perfilStore'
import type { PerfilPayload, Usuario } from '@/types/auth'

vi.mock('@/services/authService', () => ({
  authService: { atualizarPerfil: vi.fn() },
}))

const atualizarMock = vi.mocked(authService.atualizarPerfil)

const usuario: Usuario = { id: 'usr_1', email: 'ana@exemplo.com', nome: 'Ana' }

const payload: PerfilPayload = {
  nome: 'Ana Souza',
  email: 'ana.souza@exemplo.com',
  telefone: '11999998888',
  fotoUrl: 'data:image/jpeg;base64,AAA',
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  useAuthStore().definirSessao({ usuario, accessToken: 'a', refreshToken: 'r', expiresIn: 3600 })
})

describe('salvar', () => {
  it('envia o payload, atualiza o usuário da sessão e devolve true', async () => {
    atualizarMock.mockResolvedValue({ id: 'usr_1', ...payload })
    const store = usePerfilStore()

    const salvou = await store.salvar(payload)

    expect(salvou).toBe(true)
    expect(atualizarMock).toHaveBeenCalledWith(payload)
    expect(useAuthStore().usuario).toMatchObject({ id: 'usr_1', ...payload })
    expect(store.erro).toBeNull()
    expect(store.salvando).toBe(false)
  })

  it('remover a foto (fotoUrl null) limpa a foto do usuário', async () => {
    useAuthStore().atualizarUsuario({ ...usuario, fotoUrl: 'data:antiga' })
    atualizarMock.mockResolvedValue({ id: 'usr_1', ...payload, fotoUrl: null })

    await usePerfilStore().salvar({ ...payload, fotoUrl: null })

    expect(useAuthStore().usuario?.fotoUrl).toBeNull()
  })

  it('em erro devolve false, guarda a mensagem e não altera o usuário', async () => {
    atualizarMock.mockRejectedValue(new Error('falhou'))
    const store = usePerfilStore()

    const salvou = await store.salvar(payload)

    expect(salvou).toBe(false)
    expect(store.erro).toBeTruthy()
    expect(store.salvando).toBe(false)
    expect(useAuthStore().usuario).toEqual(usuario)
  })

  it('marca salvando durante a requisição', async () => {
    let concluir!: (u: Usuario) => void
    atualizarMock.mockReturnValue(new Promise<Usuario>((resolve) => (concluir = resolve)))
    const store = usePerfilStore()

    const promessa = store.salvar(payload)
    expect(store.salvando).toBe(true)

    concluir({ id: 'usr_1', ...payload })
    await promessa
    expect(store.salvando).toBe(false)
  })
})
