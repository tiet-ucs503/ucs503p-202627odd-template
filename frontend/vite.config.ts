import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Tells the browser that this page may only exchange data with this app and
 * its own backend. Anything else is refused by the browser itself.
 *
 * Why: the face-tracking library (MediaPipe) posts a small usage log to a
 * Google address and has no switch to turn that off. The log holds no image,
 * but a children's app should not send anything to a third party. With this
 * rule the request never leaves the browser. (Fonts are downloads of files,
 * not data connections, so they are not affected.)
 */
function onlyTalkToOurServer(apiUrl: string, dev: boolean): Plugin {
  // accounts.google.com is Google's sign-in service, used only when "Sign in with Google" is set up.
  const allowed = ["'self'", new URL(apiUrl).origin, 'https://accounts.google.com', 'blob:', 'data:'];
  if (dev) allowed.push('ws:'); // the dev server's live reload
  return {
    name: 'only-talk-to-our-server',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: `connect-src ${allowed.join(' ')}` },
        injectTo: 'head-prepend',
      },
    ],
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => ({
  plugins: [
    react(),
    onlyTalkToOurServer(loadEnv(mode, fileURLToPath(new URL('.', import.meta.url))).VITE_API_URL ?? 'http://localhost:8001', command === 'serve'),
  ],
  server: {
    host: true,
    port: 5173,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true, // tests read effects.css to check its animation rules
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
}));
