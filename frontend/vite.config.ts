import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const localBackend = process.env.BACKEND_URL
  ?? process.env.VITE_BACKEND_URL
  ?? `http://127.0.0.1:${process.env.BACKEND_PORT ?? '3000'}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL ?? 'http://backend:3000',
        changeOrigin: true,
      },
      '/admin/queues': {
        target: process.env.BACKEND_URL ?? 'http://backend:3000',
        changeOrigin: true,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: localBackend,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
