import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    strictPort: false,
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/storage', 'firebase/auth'],
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          charts: ['recharts'],
          pdf: ['pdfjs-dist', 'jspdf'],
          leaflet: ['leaflet', 'react-leaflet'],
          motion: ['framer-motion'],
          telemetry: ['papaparse', 'tesseract.js'],
        },
      },
    },
  },
});

