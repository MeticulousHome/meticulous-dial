import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const root = path.resolve('tests/idle-screen');

export default defineConfig({
  root,
  publicDir: path.resolve('public'),
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /.*\/hooks\/(useSettings|useWifi)$/,
        replacement: path.join(root, 'mocks.ts')
      },
      {
        find: /.*\/api\/api$/,
        replacement: path.join(root, 'mocks.ts')
      },
      {
        find: /.*\/navigation\/routes$/,
        replacement: path.join(root, 'mocks.ts')
      },
      { find: '/src', replacement: path.resolve('src') }
    ]
  },
  server: {
    host: '127.0.0.1',
    port: 1435,
    strictPort: true,
    fs: { allow: [process.cwd()] }
  }
});
