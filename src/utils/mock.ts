import { IPresetSetting } from '../types/index';

export const dummyOptions = [
  {
    label: '',
    id: -2,
    key: '',
    type: '',
    value: ''
  },
  {
    label: '',
    id: -1,
    key: '',
    type: '',
    value: ''
  }
] as unknown as IPresetSetting[];

export const settingsDefaultNewPreset: IPresetSetting[] = [
  {
    id: 1,
    type: 'text',
    key: 'name',
    label: `name`,
    value: 'New Preset'
  },
  {
    id: 2,
    type: 'numerical',
    key: 'pressure',
    label: 'pressure',
    value: 8,
    unit: 'bar'
  },
  {
    id: 3,
    type: 'numerical',
    key: 'temperature',
    label: 'temperature',
    value: 85,
    unit: '°c'
  },
  {
    id: 4,
    type: 'on-off',
    key: 'pre-infusion',
    label: 'pre-infusion',
    value: 'yes'
  },
  {
    id: 5,
    type: 'on-off',
    key: 'pre-heat',
    label: 'pre-heat',
    value: 'yes'
  },
  {
    id: 6,
    type: 'numerical',
    key: 'output',
    label: 'output',
    value: 36,
    unit: 'g'
  },
  {
    id: 7,
    type: 'multiple-option',
    key: 'purge',
    label: 'purge',
    value: 'automatic'
  }
];
