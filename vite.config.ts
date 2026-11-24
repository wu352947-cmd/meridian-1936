import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_URL ?? (mode === 'development' ? '/' : '/meridian-1936/'),
  plugins: [preact()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
}));
