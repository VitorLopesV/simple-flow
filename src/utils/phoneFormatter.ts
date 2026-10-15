/** Só os dígitos, limitados a DDD + 9 dígitos (11). */
export function phoneDigitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11)
}

/** Máscara progressiva de telefone BR: `(11) 99999-9999` (ou `(11) 9999-9999` com 10 dígitos). */
export function formatPhone(value: string): string {
  const digits = phoneDigitsOnly(value)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}
