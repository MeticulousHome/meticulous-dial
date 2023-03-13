import { IPreset, IPresetSetting } from '../types/index';

export const MockPresets: IPreset[] = [
  {
    id: 1,
    name: 'Filter 2.1',
    sensors: {
      t: '53',
      p: '40',
      w: '300',
      f: '0'
    },
    time: '10'
  },
  {
    id: 2,
    name: 'Espresso',
    sensors: {
      t: '53',
      p: '40',
      w: '310',
      f: '0'
    },
    time: '20'
  },
  {
    id: 3,
    name: 'Mariage Frères',
    sensors: {
      t: '53',
      p: '50',
      w: '320',
      f: '0'
    },
    time: '5'
  }
];

export const dummyOptions = [
  {
    label: '',
    id: -2,
    key: '',
    type: ''
  },
  {
    label: '',
    id: -1,
    key: '',
    type: ''
  }
];

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
      id: 5,
      type: 'multiple-option',
      key: 'ratio',
      label: 'ratio: 2:1',
      value: '2:1'
    },
    {
      id: 6,
      type: 'numerical',
      key: 'dose',
      label: 'dose: 18g',
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
    label: `name: New`,
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
    type: 'multiple-option',
    key: 'ratio',
    label: 'ratio: 2:1',
    value: '2:1'
  },
  {
    id: 6,
    type: 'numerical',
    key: 'dose',
    label: 'dose: 18g',
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
