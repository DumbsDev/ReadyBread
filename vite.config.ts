import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Critical: must be '/' for Firebase Hosting root
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
    reportCompressedSize: false
  },
  optimizeDeps: {
  extensions: ["md"]
  },
  assetsInclude: ["**/*.md"],

})
