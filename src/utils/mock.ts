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

export const generateMockSetting = (name: string): IPresetSetting[] => {
  return [
    {
      id: 1,
      type: 'text',
      key: 'name',
      label: `name: ${name}`,
      value: name
    },
    {
      id: 2,
      type: 'numerical',
      key: 'pressure',
      label: 'pressure: 9 bar',
      value: 9,
      unit: 'bar'
    },
    {
      id: 3,
      type: 'numerical',
      key: 'temperature',
      label: 'temperature: 86°c',
      value: 86,
      unit: '°c'
    },
    {
      id: 4,
      type: 'on-off',
      key: 'pre-infusion',
      label: 'pre-infusion: yes',
      value: 'yes'
    },
    {
      id: 6,
      type: 'numerical',
      key: 'output',
      label: 'output',
      value: 18,
      unit: 'g'
    },
    {
      id: 7,
      type: 'multiple-option',
      key: 'purge',
      label: 'purge: automatic',
      value: 'automatic'
    },
    {
      id: 8,
      type: 'action',
      key: 'save',
      label: 'save'
    },
    {
      id: 9,
      type: 'action',
      key: 'discard',
      label: 'discard'
    }
  ];
};

export const settingsDefaultNewPreset: IPresetSetting[] = [
  {
    id: 1,
    type: 'text',
    key: 'name',
    label: `name: New Preset`,
    value: 'New'
  },
  {
    id: 2,
    type: 'numerical',
    key: 'pressure',
    label: 'pressure: 8 bar',
    value: 8,
    unit: 'bar'
  },
  {
    id: 3,
    type: 'numerical',
    key: 'temperature',
    label: 'temperature: 85°c',
    value: 85,
    unit: '°c'
  },
  {
    id: 4,
    type: 'on-off',
    key: 'pre-infusion',
    label: 'pre-infusion: yes',
    value: 'yes'
  },
  {
    id: 5,
    type: 'numerical',
    key: 'output',
    label: 'output',
    value: 18,
    unit: 'g'
  },
  {
    id: 6,
    type: 'multiple-option',
    key: 'purge',
    label: 'purge: automatic',
    value: 'automatic'
  },
  {
    id: 7,
    type: 'action',
    key: 'save',
    label: 'save'
  },
  {
    id: 8,
    type: 'action',
    key: 'discard',
    label: 'discard'
  }
];
