import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // lets `vite preview` serve on a hosting domain (e.g. a Render Web Service)
  preview: { allowedHosts: true },
})
