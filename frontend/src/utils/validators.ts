/**
 * Regras de validação usadas com o VeeValidate.
 *
 * Cada regra retorna `true` quando válida ou a mensagem de erro. Elas são
 * combináveis via `compose()`, o que evita trazer yup/zod só para formulários
 * simples como os desta aplicação.
 */
import { parseCurrency } from './currencyFormatter'
import { toDate, toISODate } from './dateFormatter'

export type Rule<T = unknown> = (value: T) => true | string

export function compose<T>(...rules: Rule<T>[]): Rule<T> {
  return (value: T) => {
    for (const rule of rules) {
      const result = rule(value)
      if (result !== true) return result
    }
    return true
  }
}

export const required =
  (field = 'Campo'): Rule =>
  (value) => {
    if (value === null || value === undefined) return `${field} é obrigatório.`
    if (typeof value === 'string' && value.trim() === '') return `${field} é obrigatório.`
    if (Array.isArray(value) && value.length === 0) return `${field} é obrigatório.`
    return true
  }

export const minLength =
  (min: number, field = 'Campo'): Rule =>
  (value) => {
    const text = String(value ?? '').trim()
    return text.length >= min ? true : `${field} deve ter ao menos ${min} caracteres.`
  }

export const maxLength =
  (max: number, field = 'Campo'): Rule =>
  (value) => {
    const text = String(value ?? '')
    return text.length <= max ? true : `${field} deve ter no máximo ${max} caracteres.`
  }

/** Aceita o texto formatado do input de moeda (`R$ 1.234,56`). */
export const positiveAmount =
  (field = 'Valor'): Rule =>
  (value) => {
    const number = parseCurrency(value as string)
    if (!Number.isFinite(number)) return `${field} inválido.`
    if (number <= 0) return `${field} deve ser maior que zero.`
    if (number > 999_999_999) return `${field} excede o limite permitido.`
    return true
  }

export const isoDate =
  (field = 'Data'): Rule =>
  (value) => {
    const text = String(value ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${field} inválida.`
    // `Date` normaliza dias inexistentes (30/02 vira 02/03); o round-trip os detecta.
    return toISODate(toDate(text)) === text ? true : `${field} inválida.`
  }

export const numberBetween =
  (min: number, max: number, field = 'Valor'): Rule =>
  (value) => {
    const number = Number(value)
    if (!Number.isFinite(number)) return `${field} deve ser um número.`
    if (number < min || number > max) return `${field} deve estar entre ${min} e ${max}.`
    return true
  }

export const digitsOnly =
  (count: number, field = 'Campo'): Rule =>
  (value) => {
    const text = String(value ?? '')
    return new RegExp(`^\\d{${count}}$`).test(text)
      ? true
      : `${field} deve conter ${count} dígitos.`
  }

export const hexColor =
  (field = 'Cor'): Rule =>
  (value) =>
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value ?? '')) ? true : `${field} inválida.`

export const validEmail =
  (field = 'E-mail'): Rule =>
  (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim()) ? true : `${field} inválido.`

/** Telefone é opcional: vazio passa; preenchido precisa de DDD + 8 ou 9 dígitos. */
export const optionalPhone =
  (field = 'Telefone'): Rule =>
  (value) => {
    const digits = String(value ?? '').replace(/\D/g, '')
    if (digits === '') return true
    return digits.length === 10 || digits.length === 11 ? true : `${field} inválido.`
  }
