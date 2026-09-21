import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePeriodoStore } from '@/stores/periodoStore'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 15, 12))
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('estado inicial', () => {
  it('começa no mês atual', () => {
    const store = usePeriodoStore()

    expect(store.periodo).toEqual({ mes: 8, ano: 2026 })
  })

  it('segue o relógio no momento da criação do store', () => {
    vi.setSystemTime(new Date(2027, 0, 31, 12))
    setActivePinia(createPinia())

    expect(usePeriodoStore().periodo).toEqual({ mes: 1, ano: 2027 })
  })
})

describe('avancar / voltar', () => {
  it('avança 1 mês por padrão', () => {
    const store = usePeriodoStore()

    store.avancar()

    expect(store.periodo).toEqual({ mes: 9, ano: 2026 })
  })

  it('volta 1 mês por padrão', () => {
    const store = usePeriodoStore()

    store.voltar()

    expect(store.periodo).toEqual({ mes: 7, ano: 2026 })
  })

  it('avança N meses com virada de ano', () => {
    const store = usePeriodoStore()

    store.avancar(5)

    expect(store.periodo).toEqual({ mes: 1, ano: 2027 })
  })

  it('volta N meses com virada de ano', () => {
    const store = usePeriodoStore()

    store.voltar(8)

    expect(store.periodo).toEqual({ mes: 12, ano: 2025 })
  })

  it('avança de dezembro para janeiro e volta de janeiro para dezembro', () => {
    const store = usePeriodoStore()
    store.definir({ mes: 12, ano: 2026 })

    store.avancar()
    expect(store.periodo).toEqual({ mes: 1, ano: 2027 })

    store.voltar()
    expect(store.periodo).toEqual({ mes: 12, ano: 2026 })
  })

  it('avancar e voltar são inversos e 0 não altera', () => {
    const store = usePeriodoStore()

    store.avancar(14)
    store.voltar(14)
    expect(store.periodo).toEqual({ mes: 8, ano: 2026 })

    store.avancar(0)
    expect(store.periodo).toEqual({ mes: 8, ano: 2026 })
  })
})

describe('definir', () => {
  it('atualiza o período', () => {
    const store = usePeriodoStore()

    store.definir({ mes: 3, ano: 2025 })

    expect(store.periodo).toEqual({ mes: 3, ano: 2025 })
  })

  it('copia o objeto: mutar o original não altera o store', () => {
    const store = usePeriodoStore()
    const original = { mes: 3, ano: 2025 }

    store.definir(original)
    original.mes = 12
    original.ano = 1999

    expect(store.periodo).toEqual({ mes: 3, ano: 2025 })
  })

  it('mutar o estado do store não altera o objeto informado', () => {
    const store = usePeriodoStore()
    const original = { mes: 3, ano: 2025 }

    store.definir(original)
    store.periodo.mes = 11

    expect(original).toEqual({ mes: 3, ano: 2025 })
  })
})

describe('irParaHoje', () => {
  it('volta ao mês atual', () => {
    const store = usePeriodoStore()
    store.voltar(10)

    store.irParaHoje()

    expect(store.periodo).toEqual({ mes: 8, ano: 2026 })
  })

  it('usa o relógio no momento da chamada', () => {
    const store = usePeriodoStore()
    vi.setSystemTime(new Date(2026, 8, 10, 12))

    store.irParaHoje()

    expect(store.periodo).toEqual({ mes: 9, ano: 2026 })
  })
})

describe('rotulo', () => {
  it('formata o período atual e reage às mudanças', () => {
    const store = usePeriodoStore()
    expect(store.rotulo).toBe('Agosto de 2026')

    store.avancar()
    expect(store.rotulo).toBe('Setembro de 2026')

    store.definir({ mes: 1, ano: 2025 })
    expect(store.rotulo).toBe('Janeiro de 2025')
  })
})

describe('ehMesAtual', () => {
  it('é verdadeiro no mês atual e reage às mudanças', () => {
    const store = usePeriodoStore()
    expect(store.ehMesAtual).toBe(true)

    store.avancar()
    expect(store.ehMesAtual).toBe(false)

    store.voltar()
    expect(store.ehMesAtual).toBe(true)
  })

  it('exige o mesmo ano, não só o mesmo mês', () => {
    const store = usePeriodoStore()

    store.definir({ mes: 8, ano: 2025 })

    expect(store.ehMesAtual).toBe(false)
  })

  it('volta a ser verdadeiro após irParaHoje', () => {
    const store = usePeriodoStore()
    store.voltar(3)
    expect(store.ehMesAtual).toBe(false)

    store.irParaHoje()

    expect(store.ehMesAtual).toBe(true)
  })
})

describe('isolamento entre testes', () => {
  it('cada Pinia nova cria um store independente', () => {
    const primeiro = usePeriodoStore()
    primeiro.avancar(3)

    setActivePinia(createPinia())
    const segundo = usePeriodoStore()

    expect(segundo.periodo).toEqual({ mes: 8, ano: 2026 })
  })
})
