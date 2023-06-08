import type { StorybookConfig } from '@storybook/react-webpack5';
const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions'
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },
  docs: {
    autodocs: 'tag'
  },
  webpackFinal: async (config) => {
    // Replace storybook provided babel-loader with ts-loader to align with production config
    if (config.module?.rules) {
      const babelIndex = config.module.rules.findIndex((rule: any) =>
        rule.use?.find((use: any) => use.loader?.includes('babel-loader'))
      );
      if (babelIndex !== -1) {
        config.module.rules[babelIndex] = {
          test: /\.tsx?$/,
          exclude: /(node_modules|\.webpack)/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true
            }
          }
        };
      }
    }
    return config;
  }
};
export default config;
