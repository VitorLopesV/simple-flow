import { toast } from 'vue-sonner'

/**
 * Fachada sobre o vue-sonner. Concentrar as chamadas aqui mantém a troca da
 * biblioteca de toasts como um detalhe de implementação.
 */
export function useNotify() {
  return {
    sucesso: (mensagem: string, descricao?: string) => toast.success(mensagem, { description: descricao }),
    erro: (mensagem: string, descricao?: string) => toast.error(mensagem, { description: descricao }),
    info: (mensagem: string, descricao?: string) => toast.info(mensagem, { description: descricao }),
    aviso: (mensagem: string, descricao?: string) => toast.warning(mensagem, { description: descricao }),
  }
}

export const notificar = useNotify()
