import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // Proxy /api/* to the uvicorn backend so the browser sees same-origin
    // requests (sidesteps CORS + Chrome's Private Network Access checks).
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Defaults are tuned for short JSON requests; raise the timeouts
        // and disable response buffering so multipart uploads survive.
        timeout: 0,
        proxyTimeout: 0,
        ws: false,
        // Log proxy lifecycle so we can see when requests stall.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log(`[vite-proxy] → ${req.method} ${req.url}`);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log(`[vite-proxy] ← ${proxyRes.statusCode} ${req.url}`);
          });
          proxy.on('error', (err, req) => {
            console.error(`[vite-proxy] ✖ ${req.method} ${req.url} :: ${err.message}`);
          });
        },
      },
    },
  },
})
