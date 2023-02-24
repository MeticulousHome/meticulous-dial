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
    name: '',
    id: -2,
    key: ''
  },
  {
    name: '',
    id: -1,
    key: ''
  }
];

export const generateMockSetting = (name: string): IPresetSetting[] => {
  return [
    {
      name: `name: ${name}`,
      id: 1,
      key: 'name'
    },
    {
      name: 'pressure: 9 bar',
      id: 2,
      key: 'pressure'
    },
    {
      name: 'temperature: 86°c',
      id: 3,
      key: 'temperature'
    },
    {
      name: 'pre-infusion: yes',
      id: 4,
      key: 'pre-infusion'
    },
    {
      name: 'ratio: 2:1',
      id: 5,
      key: 'ratio'
    },
    {
      name: 'dose: 18g',
      id: 6,
      key: 'dose'
    },
    {
      name: 'purge: automatic',
      id: 6,
      key: 'purge'
    },
    {
      name: 'save',
      id: 7,
      key: 'save'
    },
    {
      name: 'discard',
      id: 8,
      key: 'discard'
    }
  ];
};
