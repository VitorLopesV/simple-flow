import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/** Origem (`https://host:porta`) de uma URL absoluta; `null` para URL relativa (mesma origem do app). */
function apiOrigin(apiUrl: string | undefined): string | null {
  if (!apiUrl || !/^https?:\/\//i.test(apiUrl)) return null
  return new URL(apiUrl).origin
}

/**
 * Restringe o `connect-src` à API configurada em `VITE_API_URL`, via `<meta>` CSP no
 * `index.html` do build. O `vercel.json` já envia a CSP completa por cabeçalho, mas é
 * estático e não enxerga variáveis de ambiente, então lá o `connect-src` é amplo
 * (`'self' https:`). O navegador aplica as duas políticas ao mesmo tempo e vale a mais
 * restritiva: na prática, o app só conecta na própria origem e na API.
 * Só roda no build: o dev server do Vite usa WebSocket de HMR e não deve ser bloqueado.
 */
function apiConnectSrcCsp(mode: string): Plugin {
  return {
    name: 'simpleflow:api-connect-src-csp',
    apply: 'build',
    transformIndexHtml() {
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      const origin = apiOrigin(env.VITE_API_URL)
      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: `connect-src 'self'${origin ? ` ${origin}` : ''}`,
          },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [vue(), tailwindcss(), apiConnectSrcCsp(mode)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
  },
  server: {
    port: 5180,
    open: false,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Mantém as libs pesadas fora do chunk de entrada; as páginas já são
        // divididas automaticamente pelos imports dinâmicos do router.
        manualChunks: {
          charts: ['chart.js', 'vue-chartjs'],
        },
      },
    },
  },
}))
