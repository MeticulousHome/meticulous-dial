import type { Preview } from '@storybook/react';

import '../src/globals.css';
import 'swiper/swiper-bundle.min.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/
      }
    },
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: 'black'
        }
      ]
    },
    viewport: {
      viewports: {
        dial: {
          name: 'Meticulous Espresso Dial',
          styles: {
            width: '480px',
            height: '480px'
          }
        }
      },
      defaultViewport: 'dial'
    }
  },
  decorators: [
    (Story) => (
      <div className="main-layout">
        <Story />
      </div>
    )
  ]
};

export default preview;
