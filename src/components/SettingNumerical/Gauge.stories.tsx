import type { Meta, StoryObj } from '@storybook/react';

import { Gauge } from './Gauge';

const meta: Meta<typeof Gauge> = {
  title: 'Gauge',
  component: Gauge,
  argTypes: {
    title: { type: 'string' },
    value: { type: 'number' },
    maxValue: { type: 'number' },
    precision: { type: 'number' },
    unit: {
      options: ['bar', 'celcius', 'gram'],
      control: { type: 'radio' }
    }
  }
};

export default meta;
type Story = StoryObj<typeof Gauge>;

export const Temperature: Story = {
  args: {
    title: 'temperature',
    value: 86,
    maxValue: 99,
    precision: 1,
    unit: 'celcius'
  }
};

export const Pressure: Story = {
  args: {
    title: 'pressure',
    value: 9,
    maxValue: 13,
    precision: 1,
    unit: 'bar'
  }
};

export const Weight: Story = {
  args: {
    title: 'output',
    value: 0,
    maxValue: 100,
    precision: 0,
    unit: 'gram'
  }
};
