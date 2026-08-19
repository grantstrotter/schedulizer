import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

// GitHub Pages project sites serve from /<repo-name>/, so every asset and internal
// link needs that prefix baked in at build time. Dev server stays at the root ("/")
// since Vite serves it directly there.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/schedulizer/' : '/',
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        schedule: resolve(__dirname, 'schedule.html'),
        distribute: resolve(__dirname, 'distribute.html')
      }
    }
  }
}));
