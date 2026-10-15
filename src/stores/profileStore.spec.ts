import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'
import type { ProfilePayload, User } from '@/types/auth'

vi.mock('@/services/authService', () => ({
  authService: { updateProfile: vi.fn() },
}))

const updateMock = vi.mocked(authService.updateProfile)

const user: User = { id: 'usr_1', email: 'ana@exemplo.com', name: 'Ana' }

const payload: ProfilePayload = {
  name: 'Ana Souza',
  email: 'ana.souza@exemplo.com',
  phone: '11999998888',
  photoUrl: 'data:image/jpeg;base64,AAA',
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  useAuthStore().setSession({ user, accessToken: 'a', refreshToken: 'r', expiresIn: 3600 })
})

describe('save', () => {
  it('envia o payload, atualiza o usuário da sessão e devolve true', async () => {
    updateMock.mockResolvedValue({ id: 'usr_1', ...payload })
    const store = useProfileStore()

    const salvou = await store.save(payload)

    expect(salvou).toBe(true)
    expect(updateMock).toHaveBeenCalledWith(payload)
    expect(useAuthStore().user).toMatchObject({ id: 'usr_1', ...payload })
    expect(store.error).toBeNull()
    expect(store.saving).toBe(false)
  })

  it('remover a foto (photoUrl null) limpa a foto do usuário', async () => {
    useAuthStore().updateUser({ ...user, photoUrl: 'data:antiga' })
    updateMock.mockResolvedValue({ id: 'usr_1', ...payload, photoUrl: null })

    await useProfileStore().save({ ...payload, photoUrl: null })

    expect(useAuthStore().user?.photoUrl).toBeNull()
  })

  it('em erro devolve false, guarda a mensagem e não altera o usuário', async () => {
    updateMock.mockRejectedValue(new Error('falhou'))
    const store = useProfileStore()

    const salvou = await store.save(payload)

    expect(salvou).toBe(false)
    expect(store.error).toBeTruthy()
    expect(store.saving).toBe(false)
    expect(useAuthStore().user).toEqual(user)
  })

  it('marca salvando durante a requisição', async () => {
    let finish!: (u: User) => void
    updateMock.mockReturnValue(new Promise<User>((resolve) => (finish = resolve)))
    const store = useProfileStore()

    const promessa = store.save(payload)
    expect(store.saving).toBe(true)

    finish({ id: 'usr_1', ...payload })
    await promessa
    expect(store.saving).toBe(false)
  })
})
