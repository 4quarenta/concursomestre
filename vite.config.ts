/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      headers: {
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
        'Cross-Origin-Opener-Policy': 'unsafe-none',
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@services': path.resolve(__dirname, './src/services'),
        '@providers': path.resolve(__dirname, './src/providers'),
        '@constants': path.resolve(__dirname, './src/constants'),
        '@types': path.resolve(__dirname, './src/types/index.ts'),
        'types': path.resolve(__dirname, './src/types/index.ts'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return;
            }

            if (id.includes('pdfjs-dist')) {
              return 'pdf';
            }

            if (id.includes('recharts')) {
              return 'charts';
            }

            if (id.includes('@stripe')) {
              return 'stripe';
            }

            if (id.includes('@google/genai') || id.includes('react-google-recaptcha')) {
              return 'integrations';
            }

            if (id.includes('framer-motion') || id.includes('lucide-react')) {
              return 'motion-icons';
            }

            if (
              id.includes('react-router-dom') ||
              id.includes('react-dom') ||
              id.includes('react-is') ||
              id.includes('/react/') ||
              id.includes('\\react\\') ||
              id.includes('scheduler')
            ) {
              return 'react-vendor';
            }
          },
        },
      },
    },
    test: {
      environment: 'node',
      globals: true,
    }
  };
});
