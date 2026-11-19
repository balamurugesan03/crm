import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Super admin console — a separate app from the workspace client.
// VITE_BASE_PATH: sub-path it is served from in production (.env.production), e.g. /crm/admin/
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, process.cwd(), 'VITE_').VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 5731,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:5050', changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mantine: ['@mantine/core', '@mantine/hooks', '@mantine/form', '@mantine/notifications', '@mantine/modals', '@mantine/dates'],
          charts: ['recharts', '@mantine/charts'],
        },
      },
    },
  },
}));
