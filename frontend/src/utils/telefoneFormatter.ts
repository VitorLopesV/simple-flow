/** Só os dígitos, limitados a DDD + 9 dígitos (11). */
export function apenasDigitosTelefone(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 11)
}

/** Máscara progressiva de telefone BR: `(11) 99999-9999` (ou `(11) 9999-9999` com 10 dígitos). */
export function formatarTelefone(valor: string): string {
  const digitos = apenasDigitosTelefone(valor)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}
