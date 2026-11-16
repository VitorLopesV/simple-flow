import { beforeEach, describe, expect, it, vi } from 'vitest'

// As constantes de `http.ts` são lidas na importação: fixa o modo mock e zera a latência antes dela.
vi.hoisted(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_LATENCY', '0')
})

import { mockDb } from '@/services/mock'
import { routineService } from '@/services/routineService'
import type { RoutinePayload } from '@/types/routine'

const WEEKLY: RoutinePayload = {
  name: 'Tomar remédio',
  repeat: { mode: 'DIAS_DA_SEMANA', days: [5, 1, 3, 1] },
  times: [{ time: '08:00' }, { time: null }],
}

describe('routineService (mock)', () => {
  beforeEach(async () => {
    const db = await mockDb()
    db.routineItems.splice(0)
  })

  it('começa vazio', async () => {
    expect(await routineService.list()).toEqual([])
  })

  it('cria o item na área Rotina, com dias ordenados e sem duplicados', async () => {
    const db = await mockDb()
    const created = await routineService.create({ ...WEEKLY, name: '  Tomar remédio ' })

    expect(created.name).toBe('Tomar remédio')
    expect(created.areaId).toBe(db.areas.find((area) => area.system)?.id)
    expect(created.repeat).toEqual({ mode: 'DIAS_DA_SEMANA', days: [1, 3, 5] })
  })

  it('lista em ordem alfabética', async () => {
    await routineService.create({ ...WEEKLY, name: 'Treinar' })
    await routineService.create({ ...WEEKLY, name: 'Acordar cedo' })

    expect((await routineService.list()).map((item) => item.name)).toEqual(['Acordar cedo', 'Treinar'])
  })

  it('cria no modo "a cada N dias"', async () => {
    const created = await routineService.create({
      name: 'Regar plantas',
      repeat: { mode: 'A_CADA_N_DIAS', interval: 3, startDate: '2026-11-16' },
      times: [{ time: null }],
    })
    expect(created.repeat).toEqual({ mode: 'A_CADA_N_DIAS', interval: 3, startDate: '2026-11-16' })
  })

  it('substitui o item inteiro na edição', async () => {
    const created = await routineService.create(WEEKLY)
    const updated = await routineService.update(created.id, {
      name: 'Treinar',
      repeat: { mode: 'A_CADA_N_DIAS', interval: 2, startDate: '2026-11-17' },
      times: [{ time: '18:00' }],
    })

    expect(updated).toMatchObject({ id: created.id, name: 'Treinar', times: [{ time: '18:00' }] })
    expect(updated.repeat.mode).toBe('A_CADA_N_DIAS')
  })

  it('remove o item', async () => {
    const created = await routineService.create(WEEKLY)
    await routineService.remove(created.id)
    expect(await routineService.list()).toEqual([])
  })

  it('barra o que a API recusaria', async () => {
    await expect(routineService.create({ ...WEEKLY, name: ' ' })).rejects.toThrow('nome')
    await expect(
      routineService.create({ ...WEEKLY, repeat: { mode: 'DIAS_DA_SEMANA', days: [] } }),
    ).rejects.toThrow('dia da semana')
    await expect(
      routineService.create({ ...WEEKLY, repeat: { mode: 'A_CADA_N_DIAS', interval: 366, startDate: '2026-11-16' } }),
    ).rejects.toThrow('intervalo')
    await expect(routineService.create({ ...WEEKLY, times: [] })).rejects.toThrow('vezes por dia')
    await expect(
      routineService.create({ ...WEEKLY, times: [{ time: '08:00' }, { time: '08:00' }] }),
    ).rejects.toThrow('repetidas')
  })

  it('falha ao editar ou excluir item inexistente', async () => {
    await expect(routineService.update('nada', WEEKLY)).rejects.toThrow('não encontrado')
    await expect(routineService.remove('nada')).rejects.toThrow('não encontrado')
  })
})
