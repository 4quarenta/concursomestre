import path from 'node:path';
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@providers': path.resolve(__dirname, 'src/providers'),
      '@constants/': `${path.resolve(__dirname, 'src/constants')}/`,
      '@constants': path.resolve(__dirname, 'src/constants/index.ts'),
      '@types': path.resolve(__dirname, 'src/types/index.ts'),
      types: path.resolve(__dirname, 'src/types/index.ts'),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 15_000,
    hookTimeout: 15_000,
    exclude: [
      ...defaultExclude,
      '.tmp/**',
      'backups/**',
      'releases/**',
    ],
  },
});
