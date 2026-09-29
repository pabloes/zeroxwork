import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

import {nodePolyfills} from 'vite-plugin-node-polyfills'; // Import node polyfills plugin
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';

const nodePolyFillPlugin = nodePolyfills({
  // Whether to polyfill specific globals.
  globals: {
    Buffer: true, // can also be 'build', 'dev', or false
    global: true,
    process: true,
  },
  // Whether to polyfill `node:` protocol imports.
  protocolImports: true,
});
const nodeGlobalPolyfillPlugin =  NodeGlobalsPolyfillPlugin({
  process: true,  // Polyfill process
  buffer: true,   // Polyfill buffer
});

// dev only: point the API proxy elsewhere (e.g. VITE_API_PROXY=https://zeroxwork.com) when no local backend is running
const apiTarget = process.env.VITE_API_PROXY || 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), wasm(),nodePolyFillPlugin, nodeGlobalPolyfillPlugin],
  build: {
    target: 'esnext',
    rollupOptions: {
      plugins: [
        nodePolyFillPlugin,
      ],
    },
  },
  resolve: {
    alias: {
      buffer: 'buffer', // Alias for buffer
    },
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget, // Proxy to the backend server
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Adjust the path if needed
      },
      '/admin': {
        target: apiTarget, // Proxy to the backend server
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Adjust the path if needed
      },
    },
  },
});
