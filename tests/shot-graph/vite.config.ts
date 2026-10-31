import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const root = path.resolve('tests/shot-graph');

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /.*\/context\/ProfileContext$/,
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
