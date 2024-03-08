import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import { DefinePlugin } from 'webpack';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CopyPlugin = require('copy-webpack-plugin');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const webpackPathByOs =
  process.env.NODE_ENV === 'production' ? 'main_window/' : '';

export const plugins = [
  new CopyPlugin({
    patterns: [
      {
        from: path.resolve(__dirname, 'src/assets/'),
        to: path.resolve(
          __dirname,
          `.webpack/renderer/${webpackPathByOs}assets/`
        )
      }
    ]
  }),
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure'
  }),
  new DefinePlugin({
    'process.env.SERVER_URL': JSON.stringify(process.env.SERVER_URL)
  })
];
