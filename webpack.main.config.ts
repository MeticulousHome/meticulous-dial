import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import * as path from 'path';
export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: {
    index: './src/index.ts',
    preload: './src/preload.ts'
  },
  // Put your normal webpack config below here
  module: {
    rules
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json']
  },
  output: {
    path: path.resolve(__dirname, '.webpack/main'), // Output both main and preload to this directory
    filename: '[name].js' // Will output main.js and preload.js
  }
};
