import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// GitHub Pages sirve el sitio en https://zeuspyec.github.io/AutoPublicador/
export default defineConfig({
  base: '/AutoPublicador/',
  plugins: [react()],
  define: { __VERSION__: JSON.stringify(version) },
  // Dos páginas: la app (/) y la consulta de placas (/placas/)
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        placas: fileURLToPath(new URL('./placas/index.html', import.meta.url)),
      },
    },
  },
})
