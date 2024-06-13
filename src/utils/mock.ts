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
    value: 'New Preset',
    isInternal: true
  },
  {
    id: 2,
    type: 'numerical',
    key: 'pressure',
    label: 'pressure',
    value: 8,
    unit: 'bar',
    isInternal: false,
    externalType: 'pressure'
  },
  {
    id: 3,
    type: 'numerical',
    key: 'temperature',
    label: 'temperature',
    value: 85,
    unit: '°c',
    isInternal: true
  },
  {
    id: 4,
    type: 'numerical',
    key: 'output',
    label: 'output',
    value: 36,
    unit: 'g',
    isInternal: true
  }
];
