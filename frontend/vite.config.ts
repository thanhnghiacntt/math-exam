import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Khi dev: Vite chạy :5173, chuyển /api và /uploads sang FastAPI :8000
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: { manualChunks: { katex: ['katex'], react: ['react', 'react-dom', 'react-router-dom'] } },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
    },
  },
})
