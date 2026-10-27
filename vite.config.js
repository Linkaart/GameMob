import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws': { target: `ws://127.0.0.1:${process.env.PORT || 3000}`, ws: true },
      '/api': { target: `http://127.0.0.1:${process.env.PORT || 3000}` },
    },
  },
  build: { rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules\/three\// }] } } } },
});
