import { toast } from 'vue-sonner'

/**
 * Fachada sobre o vue-sonner. Concentrar as chamadas aqui mantém a troca da
 * biblioteca de toasts como um detalhe de implementação.
 */
export function useNotify() {
  return {
    success: (message: string, description?: string) => toast.success(message, { description }),
    error: (message: string, description?: string) => toast.error(message, { description }),
    info: (message: string, description?: string) => toast.info(message, { description }),
    warning: (message: string, description?: string) => toast.warning(message, { description }),
  }
}

export const notify = useNotify()
