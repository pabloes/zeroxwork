import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Proxy to the backend server
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Adjust the path if needed
      },
      '/admin': {
        target: 'http://localhost:3000', // Proxy to the backend server
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Adjust the path if needed
      },
    },
  },
});
