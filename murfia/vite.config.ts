import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// В разработке клиент (5173) проксирует сокеты на сервер (3001)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/health': 'http://localhost:3001',
    },
  },
});
