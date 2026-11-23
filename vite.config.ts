import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// GitHub Pages sirve el sitio en https://zeuspyec.github.io/AutoPublicador/
export default defineConfig({
  base: '/AutoPublicador/',
  plugins: [react()],
  define: { __VERSION__: JSON.stringify(version) },
})
