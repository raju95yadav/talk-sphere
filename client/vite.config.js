import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'events'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      // Strictly prevent bundling of load test scripts or synthetic datasets
      external: [
        'load-tests',
        /^load-tests\/.*/,
        /mockUsers\.json/,
        /testMessages\.json/
      ]
    }
  },
  server: {
    watch: {
      ignored: ['**/load-tests/**', '**/server/**']
    }
  }
})
