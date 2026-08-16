export type ClassValue = string | false | null | undefined | ClassValue[]

/**
 * Junta classes condicionais. Suficiente para os componentes locais — não faz
 * merge de conflitos do Tailwind, então classes sobrescritas devem vir por
 * último na ordem de aplicação (é como os componentes deste projeto as usam).
 */
export function cn(...valores: ClassValue[]): string {
  const saida: string[] = []
  for (const valor of valores) {
    if (!valor) continue
    if (Array.isArray(valor)) {
      const aninhado = cn(...valor)
      if (aninhado) saida.push(aninhado)
    } else {
      saida.push(valor)
    }
  }
  return saida.join(' ')
}
