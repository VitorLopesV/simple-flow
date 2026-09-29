export type ClassValue = string | false | null | undefined | ClassValue[]

/**
 * Junta classes condicionais. Suficiente para os componentes locais — não faz
 * merge de conflitos do Tailwind, então classes sobrescritas devem vir por
 * último na ordem de aplicação (é como os componentes deste projeto as usam).
 */
export function cn(...values: ClassValue[]): string {
  const output: string[] = []
  for (const value of values) {
    if (!value) continue
    if (Array.isArray(value)) {
      const nested = cn(...value)
      if (nested) output.push(nested)
    } else {
      output.push(value)
    }
  }
  return output.join(' ')
}
