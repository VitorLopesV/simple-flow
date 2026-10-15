import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DateInput from '@/components/common/DateInput.vue'

type Props = InstanceType<typeof DateInput>['$props']

const mounted: VueWrapper[] = []

/** Monta já ligado como `v-model` (o valor emitido volta como prop) e preso ao documento, para o clique fora funcionar. */
function mountComponent(props: Partial<Props> = {}) {
  const wrapper: VueWrapper = mount(DateInput, {
    props: {
      modelValue: '',
      'onUpdate:modelValue': (amount: string) => wrapper.setProps({ modelValue: amount }),
      ...props,
    } as Props,
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return wrapper
}

const field = (wrapper: VueWrapper) => wrapper.get('input')
const fieldValue = (wrapper: VueWrapper) => (field(wrapper).element as HTMLInputElement).value
const emittedValues = (wrapper: VueWrapper) =>
  (wrapper.emitted('update:modelValue') ?? []).map(([amount]) => amount as string)
const lastEmitted = (wrapper: VueWrapper) => emittedValues(wrapper).at(-1)
const currentModel = (wrapper: VueWrapper) => (wrapper.props() as { modelValue: string }).modelValue

const calendarButton = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Abrir calendário"]')
const calendar = (wrapper: VueWrapper) => wrapper.find('[role="dialog"]')
const monthTitle = (wrapper: VueWrapper) => wrapper.get('[role="dialog"] p').text()
const previousMonth = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Mês anterior"]')
const nextMonth = (wrapper: VueWrapper) => wrapper.get('button[aria-label="Próximo mês"]')

/** Células de dia do calendário, na ordem da grade (42 posições). */
function calendarCells(wrapper: VueWrapper) {
  return wrapper.findAll('[role="dialog"] .grid button')
}

/** Célula do dia informado dentro do mês exibido (ignora os dias que sobram de outros meses). */
function dayCell(wrapper: VueWrapper, day: number) {
  const cells = calendarCells(wrapper).filter(
    (cell) => cell.text() === String(day) && !cell.classes('text-muted-foreground/40'),
  )
  expect(cells).toHaveLength(1)
  return cells[0]!
}

async function openCalendar(wrapper: VueWrapper) {
  await calendarButton(wrapper).trigger('click')
}

function clickOutside() {
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 7, 15, 12))
})

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('digitação com máscara', () => {
  it('digitar 15082026 mostra 15/08/2026 e emite 2026-08-15', async () => {
    const wrapper = mountComponent()

    await field(wrapper).setValue('15082026')

    expect(fieldValue(wrapper)).toBe('15/08/2026')
    expect(lastEmitted(wrapper)).toBe('2026-08-15')
  })

  it('aplica a máscara aos poucos, sem emitir enquanto incompleta', async () => {
    const wrapper = mountComponent()

    await field(wrapper).setValue('1')
    expect(fieldValue(wrapper)).toBe('1')
    await field(wrapper).setValue('150')
    expect(fieldValue(wrapper)).toBe('15/0')
    await field(wrapper).setValue('1508')
    expect(fieldValue(wrapper)).toBe('15/08')
    await field(wrapper).setValue('15/08/202')
    expect(fieldValue(wrapper)).toBe('15/08/202')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('ignora letras e corta em 8 dígitos', async () => {
    const wrapper = mountComponent()

    await field(wrapper).setValue('1a5b0c8d2026e99')

    expect(fieldValue(wrapper)).toBe('15/08/2026')
    expect(lastEmitted(wrapper)).toBe('2026-08-15')
  })

  it('aceita a data já digitada com barras', async () => {
    const wrapper = mountComponent()

    await field(wrapper).setValue('01/01/2027')

    expect(lastEmitted(wrapper)).toBe('2027-01-01')
  })

  it('apagar o campo por completo limpa o modelo', async () => {
    const wrapper = mountComponent({ modelValue: '2026-08-15' })

    await field(wrapper).setValue('')

    expect(lastEmitted(wrapper)).toBe('')
  })

  it('com o texto incompleto o modelo mantém o último valor válido', async () => {
    const wrapper = mountComponent({ modelValue: '2026-08-15' })

    await field(wrapper).setValue('15/08/202')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(currentModel(wrapper)).toBe('2026-08-15')
  })

  it('todo valor emitido tem o formato YYYY-MM-DD', async () => {
    const wrapper = mountComponent()

    for (const typed of ['15082026', '01012027', '29022028', '31122026']) {
      await field(wrapper).setValue(typed)
    }

    expect(emittedValues(wrapper)).toEqual(['2026-08-15', '2027-01-01', '2028-02-29', '2026-12-31'])
    for (const amount of emittedValues(wrapper)) expect(amount).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('atributos do campo: placeholder, teclado numérico, limite de 10 caracteres e sem autocomplete', () => {
    const wrapper = mountComponent()

    expect(field(wrapper).attributes('placeholder')).toBe('dd/mm/aaaa')
    expect(field(wrapper).attributes('inputmode')).toBe('numeric')
    expect(field(wrapper).attributes('maxlength')).toBe('10')
    expect(field(wrapper).attributes('autocomplete')).toBe('off')
  })

  it('emite blur para quem usa o componente', async () => {
    const wrapper = mountComponent()

    await field(wrapper).trigger('blur')

    expect(wrapper.emitted('blur')).toHaveLength(1)
  })
})

describe('valor externo', () => {
  it('ISO externo é exibido como dd/mm/aaaa', () => {
    expect(fieldValue(mountComponent({ modelValue: '2026-08-15' }))).toBe('15/08/2026')
  })

  it('sem valor, o campo fica vazio', () => {
    expect(fieldValue(mountComponent())).toBe('')
  })

  it('atualiza o texto quando o valor muda por fora (modo edição)', async () => {
    const wrapper = mountComponent()

    await wrapper.setProps({ modelValue: '2027-01-05' })
    expect(fieldValue(wrapper)).toBe('05/01/2027')

    await wrapper.setProps({ modelValue: '' })
    expect(fieldValue(wrapper)).toBe('')
  })

  it('não sobrescreve o que o usuário digitou quando o valor externo já é equivalente', async () => {
    const wrapper = mountComponent()

    await field(wrapper).setValue('15082026')

    expect(fieldValue(wrapper)).toBe('15/08/2026')
    expect(currentModel(wrapper)).toBe('2026-08-15')
  })
})

describe('calendário: abrir e fechar', () => {
  it('começa fechado e o botão indica o estado', () => {
    const wrapper = mountComponent()

    expect(calendar(wrapper).exists()).toBe(false)
    expect(calendarButton(wrapper).attributes('aria-expanded')).toBe('false')
    expect(calendarButton(wrapper).attributes('aria-haspopup')).toBe('dialog')
  })

  it('abre ao clicar no botão e mostra o mês de hoje quando não há valor', async () => {
    const wrapper = mountComponent()

    await openCalendar(wrapper)

    expect(calendar(wrapper).exists()).toBe(true)
    expect(calendarButton(wrapper).attributes('aria-expanded')).toBe('true')
    expect(monthTitle(wrapper)).toBe('Agosto de 2026')
  })

  it('abre no mês do valor atual', async () => {
    const wrapper = mountComponent({ modelValue: '2027-03-09' })

    await openCalendar(wrapper)

    expect(monthTitle(wrapper)).toBe('Março de 2027')
  })

  it('mostra 7 dias da semana e uma grade de 42 dias', async () => {
    const wrapper = mountComponent()

    await openCalendar(wrapper)

    const text = calendar(wrapper).text()
    for (const day of ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) expect(text).toContain(day)
    expect(calendarCells(wrapper)).toHaveLength(42)
  })

  it('clicar de novo no botão fecha', async () => {
    const wrapper = mountComponent()
    await openCalendar(wrapper)

    await openCalendar(wrapper)

    expect(calendar(wrapper).exists()).toBe(false)
  })

  it('Escape fecha o calendário', async () => {
    const wrapper = mountComponent()
    await openCalendar(wrapper)

    await wrapper.trigger('keydown', { key: 'Escape' })

    expect(calendar(wrapper).exists()).toBe(false)
  })

  it('ao reabrir, volta ao mês do valor mesmo depois de navegar', async () => {
    const wrapper = mountComponent({ modelValue: '2026-08-15' })
    await openCalendar(wrapper)
    await nextMonth(wrapper).trigger('click')
    await nextMonth(wrapper).trigger('click')
    expect(monthTitle(wrapper)).toBe('Outubro de 2026')

    await openCalendar(wrapper)
    await openCalendar(wrapper)

    expect(monthTitle(wrapper)).toBe('Agosto de 2026')
  })
})

describe('calendário: navegação entre meses', () => {
  it('avança e volta um mês', async () => {
    const wrapper = mountComponent()
    await openCalendar(wrapper)

    await nextMonth(wrapper).trigger('click')
    expect(monthTitle(wrapper)).toBe('Setembro de 2026')

    await previousMonth(wrapper).trigger('click')
    await previousMonth(wrapper).trigger('click')
    expect(monthTitle(wrapper)).toBe('Julho de 2026')
  })

  it('de dezembro avança para janeiro do ano seguinte', async () => {
    const wrapper = mountComponent({ modelValue: '2026-12-10' })
    await openCalendar(wrapper)
    expect(monthTitle(wrapper)).toBe('Dezembro de 2026')

    await nextMonth(wrapper).trigger('click')

    expect(monthTitle(wrapper)).toBe('Janeiro de 2027')
  })

  it('de janeiro volta para dezembro do ano anterior', async () => {
    const wrapper = mountComponent({ modelValue: '2026-01-10' })
    await openCalendar(wrapper)

    await previousMonth(wrapper).trigger('click')

    expect(monthTitle(wrapper)).toBe('Dezembro de 2025')
  })

  it('navegar não altera o valor', async () => {
    const wrapper = mountComponent({ modelValue: '2026-08-15' })
    await openCalendar(wrapper)

    await nextMonth(wrapper).trigger('click')
    await nextMonth(wrapper).trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(fieldValue(wrapper)).toBe('15/08/2026')
  })
})

describe('calendário: seleção de dia', () => {
  it('selecionar um dia emite o ISO correto, atualiza o campo e fecha', async () => {
    const wrapper = mountComponent()
    await openCalendar(wrapper)

    await dayCell(wrapper, 20).trigger('click')

    expect(lastEmitted(wrapper)).toBe('2026-08-20')
    expect(fieldValue(wrapper)).toBe('20/08/2026')
    expect(calendar(wrapper).exists()).toBe(false)
  })

  it('seleciona em outro mês e atravessando o ano', async () => {
    const wrapper = mountComponent({ modelValue: '2026-12-10' })
    await openCalendar(wrapper)
    await nextMonth(wrapper).trigger('click')

    await dayCell(wrapper, 15).trigger('click')

    expect(lastEmitted(wrapper)).toBe('2027-01-15')
    expect(fieldValue(wrapper)).toBe('15/01/2027')
  })

  it('dias que sobram de outros meses emitem a data do mês a que pertencem', async () => {
    const wrapper = mountComponent()
    await openCalendar(wrapper)

    // Agosto de 2026 começa num sábado: a grade abre em 26/07 e termina em 05/09.
    await calendarCells(wrapper)[0]!.trigger('click')
    expect(lastEmitted(wrapper)).toBe('2026-07-26')

    const other = mountComponent()
    await openCalendar(other)
    await calendarCells(other).at(-1)!.trigger('click')
    expect(lastEmitted(other)).toBe('2026-09-05')
  })

  it('fevereiro de ano bissexto emite o dia 29 sem deslocar a data', async () => {
    const wrapper = mountComponent({ modelValue: '2028-02-10' })
    await openCalendar(wrapper)

    await dayCell(wrapper, 29).trigger('click')

    expect(lastEmitted(wrapper)).toBe('2028-02-29')
  })

  it('cada dia do mês exibido emite exatamente o seu próprio ISO (sem off-by-one)', async () => {
    // Começa em 31/03 para que todo clique seja uma mudança de valor (mesmo valor não emite).
    const wrapper = mountComponent({ modelValue: '2026-03-31' })

    for (let day = 1; day <= 31; day += 1) {
      await openCalendar(wrapper)
      await dayCell(wrapper, day).trigger('click')

      expect(lastEmitted(wrapper)).toBe(`2026-03-${String(day).padStart(2, '0')}`)
    }
  })

  it('destaca o dia selecionado', async () => {
    const wrapper = mountComponent({ modelValue: '2026-08-20' })
    await openCalendar(wrapper)

    const highlighted = calendarCells(wrapper).filter((cell) => cell.classes('bg-primary'))

    expect(highlighted).toHaveLength(1)
    expect(highlighted[0]!.text()).toBe('20')
  })
})

describe('clique fora e ciclo de vida', () => {
  it('clique fora fecha o calendário', async () => {
    const wrapper = mountComponent()
    await openCalendar(wrapper)

    clickOutside()
    await wrapper.vm.$nextTick()

    expect(calendar(wrapper).exists()).toBe(false)
  })

  it('clique dentro do componente não fecha', async () => {
    const wrapper = mountComponent()
    await openCalendar(wrapper)

    await wrapper.get('[role="dialog"]').trigger('mousedown')
    await field(wrapper).trigger('mousedown')

    expect(calendar(wrapper).exists()).toBe(true)
  })

  it('só escuta o documento enquanto o calendário está aberto', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const wrapper = mountComponent()
    expect(addSpy).not.toHaveBeenCalledWith('mousedown', expect.any(Function))

    await openCalendar(wrapper)
    expect(addSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))

    await openCalendar(wrapper)
    expect(remove).toHaveBeenCalledWith('mousedown', expect.any(Function))
  })

  it('remove o listener do documento ao desmontar com o calendário aberto (sem vazamento)', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const wrapper = mountComponent()
    await openCalendar(wrapper)
    const registered = addSpy.mock.calls.find(([type]) => type === 'mousedown')![1]
    remove.mockClear()

    wrapper.unmount()
    mounted.splice(mounted.indexOf(wrapper), 1)

    expect(remove).toHaveBeenCalledWith('mousedown', registered)
  })

  it('depois de desmontar, cliques no documento não geram erro', async () => {
    const wrapper = mountComponent()
    await openCalendar(wrapper)

    wrapper.unmount()
    mounted.splice(mounted.indexOf(wrapper), 1)

    expect(() => clickOutside()).not.toThrow()
  })
})

describe('desabilitado, erro e rótulo', () => {
  it('desabilitado bloqueia o campo e o botão, e o calendário não abre', async () => {
    const wrapper = mountComponent({ disabled: true })

    expect(field(wrapper).attributes('disabled')).toBeDefined()
    expect(calendarButton(wrapper).attributes('disabled')).toBeDefined()

    await openCalendar(wrapper)

    expect(calendar(wrapper).exists()).toBe(false)
  })

  it('desabilitar com o calendário aberto fecha o calendário', async () => {
    const wrapper = mountComponent()
    await openCalendar(wrapper)

    await wrapper.setProps({ disabled: true })

    expect(calendar(wrapper).exists()).toBe(false)
  })

  it('erro marca o campo como inválido e mostra a mensagem', () => {
    const wrapper = mountComponent({ error: 'Data inválida.' })

    expect(wrapper.get('[role="alert"]').text()).toBe('Data inválida.')
    expect(field(wrapper).attributes('aria-invalid')).toBe('true')
  })

  it('rótulo padrão "Data" e obrigatorio', () => {
    const wrapper = mountComponent({ required: true })

    expect(wrapper.get('label').text()).toContain('Data')
    expect(field(wrapper).attributes('required')).toBeDefined()
  })
})
