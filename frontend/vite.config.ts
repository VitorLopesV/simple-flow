import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
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
})
