import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DateInput from '@/components/common/DateInput.vue'

type Props = InstanceType<typeof DateInput>['$props']

const montados: VueWrapper[] = []

/** Monta já ligado como `v-model` (o valor emitido volta como prop) e preso ao documento, para o clique fora funcionar. */
function montar(props: Partial<Props> = {}) {
  const wrapper: VueWrapper = mount(DateInput, {
    props: {
      modelValue: '',
      'onUpdate:modelValue': (valor: string) => wrapper.setProps({ modelValue: valor }),
      ...props,
    } as Props,
    attachTo: document.body,
  })
  montados.push(wrapper)
  return wrapper
}

const campo = (wrapper: VueWrapper) => wrapper.get('input')
const valorDoCampo = (wrapper: VueWrapper) => (campo(wrapper).element as HTMLInputElement).value
const valoresEmitidos = (wrapper: VueWrapper) =>
  (wrapper.emitted('update:modelValue') ?? []).map(([valor]) => valor as string)
const ultimoEmitido = (wrapper: VueWrapper) => valoresEmitidos(wrapper).at(-1)
const modeloAtual = (wrapper: VueWrapper) => (wrapper.props() as { modelValue: string }).modelValue

const botaoCalendario = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Abrir calendário"]')
const calendario = (wrapper: VueWrapper) => wrapper.find('[role="dialog"]')
const tituloDoMes = (wrapper: VueWrapper) => wrapper.get('[role="dialog"] p').text()
const mesAnterior = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Mês anterior"]')
const proximoMes = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Próximo mês"]')

/** Células de dia do calendário, na ordem da grade (42 posições). */
function celulasDoCalendario(wrapper: VueWrapper) {
  return wrapper.findAll('[role="dialog"] .grid button')
}

/** Célula do dia informado dentro do mês exibido (ignora os dias que sobram de outros meses). */
function celulaDoDia(wrapper: VueWrapper, dia: number) {
  const celulas = celulasDoCalendario(wrapper).filter(
    (celula) => celula.text() === String(dia) && !celula.classes('text-muted-foreground/40'),
  )
  expect(celulas).toHaveLength(1)
  return celulas[0]!
}

async function abrirCalendario(wrapper: VueWrapper) {
  await botaoCalendario(wrapper).trigger('click')
}

function cliqueFora() {
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 7, 15, 12))
})

afterEach(() => {
  while (montados.length) montados.pop()!.unmount()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('digitação com máscara', () => {
  it('digitar 15082026 mostra 15/08/2026 e emite 2026-08-15', async () => {
    const wrapper = montar()

    await campo(wrapper).setValue('15082026')

    expect(valorDoCampo(wrapper)).toBe('15/08/2026')
    expect(ultimoEmitido(wrapper)).toBe('2026-08-15')
  })

  it('aplica a máscara aos poucos, sem emitir enquanto incompleta', async () => {
    const wrapper = montar()

    await campo(wrapper).setValue('1')
    expect(valorDoCampo(wrapper)).toBe('1')
    await campo(wrapper).setValue('150')
    expect(valorDoCampo(wrapper)).toBe('15/0')
    await campo(wrapper).setValue('1508')
    expect(valorDoCampo(wrapper)).toBe('15/08')
    await campo(wrapper).setValue('15/08/202')
    expect(valorDoCampo(wrapper)).toBe('15/08/202')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('ignora letras e corta em 8 dígitos', async () => {
    const wrapper = montar()

    await campo(wrapper).setValue('1a5b0c8d2026e99')

    expect(valorDoCampo(wrapper)).toBe('15/08/2026')
    expect(ultimoEmitido(wrapper)).toBe('2026-08-15')
  })

  it('aceita a data já digitada com barras', async () => {
    const wrapper = montar()

    await campo(wrapper).setValue('01/01/2027')

    expect(ultimoEmitido(wrapper)).toBe('2027-01-01')
  })

  it('apagar o campo por completo limpa o modelo', async () => {
    const wrapper = montar({ modelValue: '2026-08-15' })

    await campo(wrapper).setValue('')

    expect(ultimoEmitido(wrapper)).toBe('')
  })

  it('com o texto incompleto o modelo mantém o último valor válido', async () => {
    const wrapper = montar({ modelValue: '2026-08-15' })

    await campo(wrapper).setValue('15/08/202')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(modeloAtual(wrapper)).toBe('2026-08-15')
  })

  it('todo valor emitido tem o formato YYYY-MM-DD', async () => {
    const wrapper = montar()

    for (const digitado of ['15082026', '01012027', '29022028', '31122026']) {
      await campo(wrapper).setValue(digitado)
    }

    expect(valoresEmitidos(wrapper)).toEqual(['2026-08-15', '2027-01-01', '2028-02-29', '2026-12-31'])
    for (const valor of valoresEmitidos(wrapper)) expect(valor).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('atributos do campo: placeholder, teclado numérico, limite de 10 caracteres e sem autocomplete', () => {
    const wrapper = montar()

    expect(campo(wrapper).attributes('placeholder')).toBe('dd/mm/aaaa')
    expect(campo(wrapper).attributes('inputmode')).toBe('numeric')
    expect(campo(wrapper).attributes('maxlength')).toBe('10')
    expect(campo(wrapper).attributes('autocomplete')).toBe('off')
  })

  it('emite blur para quem usa o componente', async () => {
    const wrapper = montar()

    await campo(wrapper).trigger('blur')

    expect(wrapper.emitted('blur')).toHaveLength(1)
  })
})

describe('valor externo', () => {
  it('ISO externo é exibido como dd/mm/aaaa', () => {
    expect(valorDoCampo(montar({ modelValue: '2026-08-15' }))).toBe('15/08/2026')
  })

  it('sem valor, o campo fica vazio', () => {
    expect(valorDoCampo(montar())).toBe('')
  })

  it('atualiza o texto quando o valor muda por fora (modo edição)', async () => {
    const wrapper = montar()

    await wrapper.setProps({ modelValue: '2027-01-05' })
    expect(valorDoCampo(wrapper)).toBe('05/01/2027')

    await wrapper.setProps({ modelValue: '' })
    expect(valorDoCampo(wrapper)).toBe('')
  })

  it('não sobrescreve o que o usuário digitou quando o valor externo já é equivalente', async () => {
    const wrapper = montar()

    await campo(wrapper).setValue('15082026')

    expect(valorDoCampo(wrapper)).toBe('15/08/2026')
    expect(modeloAtual(wrapper)).toBe('2026-08-15')
  })
})

describe('calendário: abrir e fechar', () => {
  it('começa fechado e o botão indica o estado', () => {
    const wrapper = montar()

    expect(calendario(wrapper).exists()).toBe(false)
    expect(botaoCalendario(wrapper).attributes('aria-expanded')).toBe('false')
    expect(botaoCalendario(wrapper).attributes('aria-haspopup')).toBe('dialog')
  })

  it('abre ao clicar no botão e mostra o mês de hoje quando não há valor', async () => {
    const wrapper = montar()

    await abrirCalendario(wrapper)

    expect(calendario(wrapper).exists()).toBe(true)
    expect(botaoCalendario(wrapper).attributes('aria-expanded')).toBe('true')
    expect(tituloDoMes(wrapper)).toBe('Agosto de 2026')
  })

  it('abre no mês do valor atual', async () => {
    const wrapper = montar({ modelValue: '2027-03-09' })

    await abrirCalendario(wrapper)

    expect(tituloDoMes(wrapper)).toBe('Março de 2027')
  })

  it('mostra 7 dias da semana e uma grade de 42 dias', async () => {
    const wrapper = montar()

    await abrirCalendario(wrapper)

    const texto = calendario(wrapper).text()
    for (const dia of ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) expect(texto).toContain(dia)
    expect(celulasDoCalendario(wrapper)).toHaveLength(42)
  })

  it('clicar de novo no botão fecha', async () => {
    const wrapper = montar()
    await abrirCalendario(wrapper)

    await abrirCalendario(wrapper)

    expect(calendario(wrapper).exists()).toBe(false)
  })

  it('Escape fecha o calendário', async () => {
    const wrapper = montar()
    await abrirCalendario(wrapper)

    await wrapper.trigger('keydown', { key: 'Escape' })

    expect(calendario(wrapper).exists()).toBe(false)
  })

  it('ao reabrir, volta ao mês do valor mesmo depois de navegar', async () => {
    const wrapper = montar({ modelValue: '2026-08-15' })
    await abrirCalendario(wrapper)
    await proximoMes(wrapper).trigger('click')
    await proximoMes(wrapper).trigger('click')
    expect(tituloDoMes(wrapper)).toBe('Outubro de 2026')

    await abrirCalendario(wrapper)
    await abrirCalendario(wrapper)

    expect(tituloDoMes(wrapper)).toBe('Agosto de 2026')
  })
})

describe('calendário: navegação entre meses', () => {
  it('avança e volta um mês', async () => {
    const wrapper = montar()
    await abrirCalendario(wrapper)

    await proximoMes(wrapper).trigger('click')
    expect(tituloDoMes(wrapper)).toBe('Setembro de 2026')

    await mesAnterior(wrapper).trigger('click')
    await mesAnterior(wrapper).trigger('click')
    expect(tituloDoMes(wrapper)).toBe('Julho de 2026')
  })

  it('de dezembro avança para janeiro do ano seguinte', async () => {
    const wrapper = montar({ modelValue: '2026-12-10' })
    await abrirCalendario(wrapper)
    expect(tituloDoMes(wrapper)).toBe('Dezembro de 2026')

    await proximoMes(wrapper).trigger('click')

    expect(tituloDoMes(wrapper)).toBe('Janeiro de 2027')
  })

  it('de janeiro volta para dezembro do ano anterior', async () => {
    const wrapper = montar({ modelValue: '2026-01-10' })
    await abrirCalendario(wrapper)

    await mesAnterior(wrapper).trigger('click')

    expect(tituloDoMes(wrapper)).toBe('Dezembro de 2025')
  })

  it('navegar não altera o valor', async () => {
    const wrapper = montar({ modelValue: '2026-08-15' })
    await abrirCalendario(wrapper)

    await proximoMes(wrapper).trigger('click')
    await proximoMes(wrapper).trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(valorDoCampo(wrapper)).toBe('15/08/2026')
  })
})

describe('calendário: seleção de dia', () => {
  it('selecionar um dia emite o ISO correto, atualiza o campo e fecha', async () => {
    const wrapper = montar()
    await abrirCalendario(wrapper)

    await celulaDoDia(wrapper, 20).trigger('click')

    expect(ultimoEmitido(wrapper)).toBe('2026-08-20')
    expect(valorDoCampo(wrapper)).toBe('20/08/2026')
    expect(calendario(wrapper).exists()).toBe(false)
  })

  it('seleciona em outro mês e atravessando o ano', async () => {
    const wrapper = montar({ modelValue: '2026-12-10' })
    await abrirCalendario(wrapper)
    await proximoMes(wrapper).trigger('click')

    await celulaDoDia(wrapper, 15).trigger('click')

    expect(ultimoEmitido(wrapper)).toBe('2027-01-15')
    expect(valorDoCampo(wrapper)).toBe('15/01/2027')
  })

  it('dias que sobram de outros meses emitem a data do mês a que pertencem', async () => {
    const wrapper = montar()
    await abrirCalendario(wrapper)

    // Agosto de 2026 começa num sábado: a grade abre em 26/07 e termina em 05/09.
    await celulasDoCalendario(wrapper)[0]!.trigger('click')
    expect(ultimoEmitido(wrapper)).toBe('2026-07-26')

    const outro = montar()
    await abrirCalendario(outro)
    await celulasDoCalendario(outro).at(-1)!.trigger('click')
    expect(ultimoEmitido(outro)).toBe('2026-09-05')
  })

  it('fevereiro de ano bissexto emite o dia 29 sem deslocar a data', async () => {
    const wrapper = montar({ modelValue: '2028-02-10' })
    await abrirCalendario(wrapper)

    await celulaDoDia(wrapper, 29).trigger('click')

    expect(ultimoEmitido(wrapper)).toBe('2028-02-29')
  })

  it('cada dia do mês exibido emite exatamente o seu próprio ISO (sem off-by-one)', async () => {
    // Começa em 31/03 para que todo clique seja uma mudança de valor (mesmo valor não emite).
    const wrapper = montar({ modelValue: '2026-03-31' })

    for (let dia = 1; dia <= 31; dia += 1) {
      await abrirCalendario(wrapper)
      await celulaDoDia(wrapper, dia).trigger('click')

      expect(ultimoEmitido(wrapper)).toBe(`2026-03-${String(dia).padStart(2, '0')}`)
    }
  })

  it('destaca o dia selecionado', async () => {
    const wrapper = montar({ modelValue: '2026-08-20' })
    await abrirCalendario(wrapper)

    const destacadas = celulasDoCalendario(wrapper).filter((celula) => celula.classes('bg-primary'))

    expect(destacadas).toHaveLength(1)
    expect(destacadas[0]!.text()).toBe('20')
  })
})

describe('clique fora e ciclo de vida', () => {
  it('clique fora fecha o calendário', async () => {
    const wrapper = montar()
    await abrirCalendario(wrapper)

    cliqueFora()
    await wrapper.vm.$nextTick()

    expect(calendario(wrapper).exists()).toBe(false)
  })

  it('clique dentro do componente não fecha', async () => {
    const wrapper = montar()
    await abrirCalendario(wrapper)

    await wrapper.get('[role="dialog"]').trigger('mousedown')
    await campo(wrapper).trigger('mousedown')

    expect(calendario(wrapper).exists()).toBe(true)
  })

  it('só escuta o documento enquanto o calendário está aberto', async () => {
    const adicionar = vi.spyOn(document, 'addEventListener')
    const remover = vi.spyOn(document, 'removeEventListener')
    const wrapper = montar()
    expect(adicionar).not.toHaveBeenCalledWith('mousedown', expect.any(Function))

    await abrirCalendario(wrapper)
    expect(adicionar).toHaveBeenCalledWith('mousedown', expect.any(Function))

    await abrirCalendario(wrapper)
    expect(remover).toHaveBeenCalledWith('mousedown', expect.any(Function))
  })

  it('remove o listener do documento ao desmontar com o calendário aberto (sem vazamento)', async () => {
    const adicionar = vi.spyOn(document, 'addEventListener')
    const remover = vi.spyOn(document, 'removeEventListener')
    const wrapper = montar()
    await abrirCalendario(wrapper)
    const registrado = adicionar.mock.calls.find(([tipo]) => tipo === 'mousedown')![1]
    remover.mockClear()

    wrapper.unmount()
    montados.splice(montados.indexOf(wrapper), 1)

    expect(remover).toHaveBeenCalledWith('mousedown', registrado)
  })

  it('depois de desmontar, cliques no documento não geram erro', async () => {
    const wrapper = montar()
    await abrirCalendario(wrapper)

    wrapper.unmount()
    montados.splice(montados.indexOf(wrapper), 1)

    expect(() => cliqueFora()).not.toThrow()
  })
})

describe('desabilitado, erro e rótulo', () => {
  it('desabilitado bloqueia o campo e o botão, e o calendário não abre', async () => {
    const wrapper = montar({ desabilitado: true })

    expect(campo(wrapper).attributes('disabled')).toBeDefined()
    expect(botaoCalendario(wrapper).attributes('disabled')).toBeDefined()

    await abrirCalendario(wrapper)

    expect(calendario(wrapper).exists()).toBe(false)
  })

  it('desabilitar com o calendário aberto fecha o calendário', async () => {
    const wrapper = montar()
    await abrirCalendario(wrapper)

    await wrapper.setProps({ desabilitado: true })

    expect(calendario(wrapper).exists()).toBe(false)
  })

  it('erro marca o campo como inválido e mostra a mensagem', () => {
    const wrapper = montar({ erro: 'Data inválida.' })

    expect(wrapper.get('[role="alert"]').text()).toBe('Data inválida.')
    expect(campo(wrapper).attributes('aria-invalid')).toBe('true')
  })

  it('rótulo padrão "Data" e obrigatorio', () => {
    const wrapper = montar({ obrigatorio: true })

    expect(wrapper.get('label').text()).toContain('Data')
    expect(campo(wrapper).attributes('required')).toBeDefined()
  })
})
