import { describe, expect, it } from 'vitest'

import { buildGoogleCalendarUrl, canAddToGoogleCalendar } from './googleCalendar'

const base = { title: 'Reunião', day: '2026-11-20', time: '14:30', estimateMinutes: 60 as const, notes: null }

describe('buildGoogleCalendarUrl', () => {
  it('monta título, início/fim pelo tempo estimado e fuso', () => {
    const url = new URL(buildGoogleCalendarUrl(base)!)
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Reunião')
    expect(url.searchParams.get('dates')).toBe('20261120T143000/20261120T153000')
    expect(url.searchParams.get('ctz')).toBe('America/Sao_Paulo')
    expect(url.searchParams.has('details')).toBe(false)
  })

  it('inclui as notas em details', () => {
    const url = new URL(buildGoogleCalendarUrl({ ...base, notes: 'Levar o contrato & café' })!)
    expect(url.searchParams.get('details')).toBe('Levar o contrato & café')
  })

  it('usa 30 minutos quando não há tempo estimado', () => {
    const url = new URL(buildGoogleCalendarUrl({ ...base, estimateMinutes: null })!)
    expect(url.searchParams.get('dates')).toBe('20261120T143000/20261120T150000')
  })

  it('vira o dia e o ano quando o fim passa da meia-noite', () => {
    const url = new URL(
      buildGoogleCalendarUrl({ ...base, day: '2026-12-31', time: '23:00', estimateMinutes: 120 })!,
    )
    expect(url.searchParams.get('dates')).toBe('20261231T230000/20270101T010000')
  })

  it('escapa caracteres especiais do título', () => {
    const link = buildGoogleCalendarUrl({ ...base, title: 'A&B=C #1' })!
    expect(new URL(link).searchParams.get('text')).toBe('A&B=C #1')
  })

  it('retorna null sem dia ou sem hora', () => {
    expect(buildGoogleCalendarUrl({ ...base, day: null })).toBeNull()
    expect(buildGoogleCalendarUrl({ ...base, time: null })).toBeNull()
  })
})

describe('canAddToGoogleCalendar', () => {
  it('exige dia e hora', () => {
    expect(canAddToGoogleCalendar({ day: '2026-11-20', time: '09:00' })).toBe(true)
    expect(canAddToGoogleCalendar({ day: '2026-11-20', time: null })).toBe(false)
    expect(canAddToGoogleCalendar({ day: null, time: '09:00' })).toBe(false)
  })
})
