import { defineConfig } from 'vite'

// Served from GitHub Pages at https://speyyman.github.io/chladni/.
export default defineConfig({
  base: process.env.BASE ?? '/chladni/',
  build: { target: 'es2022' },
})
