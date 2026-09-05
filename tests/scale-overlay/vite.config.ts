import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const root = path.resolve('tests/scale-overlay');

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /.*\/context\/ProfileContext$/,
        replacement: path.join(root, 'mocks.ts')
      },
      {
        find: /.*\/hooks\/useSettings$/,
        replacement: path.join(root, 'mocks.ts')
      },
      {
        find: './SocketProviderValue',
        replacement: path.join(root, 'mocks.ts')
      },
      {
        find: '../../utils',
        replacement: path.join(root, 'mocks.ts')
      },
      { find: '/src', replacement: path.resolve('src') }
    ]
  },
  server: {
    host: '127.0.0.1',
    port: 1434,
    strictPort: true,
    fs: { allow: [process.cwd()] }
  }
});
