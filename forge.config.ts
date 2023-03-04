import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {},
  rebuildConfig: {},
  makers: [new MakerDeb({})],
  publishers: [
    {
      name: '@electron-forge/publisher-s3',
      config: {
        bucket: process.env.S3_BUCKET,
        folder: process.env.DISTRIBUTION_FOLDER,
        public: false,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig,
        renderer: {
          config: rendererConfig,
          nodeIntegration: true, // Implies `target: 'electron-renderer'` for all entry points
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer.ts',
              name: 'main_window',
              preload: {
                js: './src/preload.ts'
              }
            }
          ]
        }
      }
    }
  ]
};

export default config;
