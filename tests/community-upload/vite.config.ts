import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const root = path.resolve('tests/community-upload');
export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@tauri-apps/api/core',
        replacement: path.join(root, 'mocks.ts')
      },
      {
        find: /.*\/hooks\/useDeviceOSStatus$/,
        replacement: path.join(root, 'mocks.ts')
      },
      { find: /.*\/store\/hooks$/, replacement: path.join(root, 'mocks.ts') },
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
