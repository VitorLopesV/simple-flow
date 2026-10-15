/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base da API; também define o `connect-src` da CSP gerada no build (ver `vite.config.ts`). */
  readonly VITE_API_URL: string
  /** Só `'true'` liga o modo mock; ausente ou qualquer outro valor usa o backend real. */
  readonly VITE_USE_MOCK?: string
  readonly VITE_MOCK_LATENCY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
