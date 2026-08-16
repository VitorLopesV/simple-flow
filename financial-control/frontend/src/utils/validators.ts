/**
 * Regras de validação usadas com o VeeValidate.
 *
 * Cada regra retorna `true` quando válida ou a mensagem de erro. Elas são
 * combináveis via `compor()`, o que evita trazer yup/zod só para formulários
 * simples como os desta aplicação.
 */
import { parseCurrency } from './currencyFormatter'

export type Regra<T = unknown> = (valor: T) => true | string

export function compor<T>(...regras: Regra<T>[]): Regra<T> {
  return (valor: T) => {
    for (const regra of regras) {
      const resultado = regra(valor)
      if (resultado !== true) return resultado
    }
    return true
  }
}

export const obrigatorio =
  (campo = 'Campo'): Regra =>
  (valor) => {
    if (valor === null || valor === undefined) return `${campo} é obrigatório.`
    if (typeof valor === 'string' && valor.trim() === '') return `${campo} é obrigatório.`
    if (Array.isArray(valor) && valor.length === 0) return `${campo} é obrigatório.`
    return true
  }

export const minimoCaracteres =
  (min: number, campo = 'Campo'): Regra =>
  (valor) => {
    const texto = String(valor ?? '').trim()
    return texto.length >= min ? true : `${campo} deve ter ao menos ${min} caracteres.`
  }

export const maximoCaracteres =
  (max: number, campo = 'Campo'): Regra =>
  (valor) => {
    const texto = String(valor ?? '')
    return texto.length <= max ? true : `${campo} deve ter no máximo ${max} caracteres.`
  }

/** Aceita o texto formatado do input de moeda (`R$ 1.234,56`). */
export const valorMonetarioPositivo =
  (campo = 'Valor'): Regra =>
  (valor) => {
    const numero = parseCurrency(valor as string)
    if (!Number.isFinite(numero)) return `${campo} inválido.`
    if (numero <= 0) return `${campo} deve ser maior que zero.`
    if (numero > 999_999_999) return `${campo} excede o limite permitido.`
    return true
  }

export const dataISO =
  (campo = 'Data'): Regra =>
  (valor) => {
    const texto = String(valor ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return `${campo} inválida.`
    const data = new Date(`${texto}T12:00:00`)
    return Number.isNaN(data.getTime()) ? `${campo} inválida.` : true
  }

export const numeroEntre =
  (min: number, max: number, campo = 'Valor'): Regra =>
  (valor) => {
    const numero = Number(valor)
    if (!Number.isFinite(numero)) return `${campo} deve ser um número.`
    if (numero < min || numero > max) return `${campo} deve estar entre ${min} e ${max}.`
    return true
  }

export const somenteDigitos =
  (quantidade: number, campo = 'Campo'): Regra =>
  (valor) => {
    const texto = String(valor ?? '')
    return new RegExp(`^\\d{${quantidade}}$`).test(texto)
      ? true
      : `${campo} deve conter ${quantidade} dígitos.`
  }

export const corHexadecimal =
  (campo = 'Cor'): Regra =>
  (valor) =>
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(valor ?? '')) ? true : `${campo} inválida.`
