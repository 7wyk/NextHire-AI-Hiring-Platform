import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so the app is reachable on a public IP / EC2
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Forward all /api/* requests to the Express backend
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
