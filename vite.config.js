import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/teaproto/',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', '@react-three/fiber', '@react-three/drei', 'three'],
  },
})
