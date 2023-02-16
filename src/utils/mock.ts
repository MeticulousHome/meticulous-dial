import { IPreset, IPresetSetting } from '../types/index';

export const MockPresets: IPreset[] = [
  {
    id: 1,
    name: 'Filter 2.1',
    sensors: {
      t: '53',
      p: '0',
      w: '300',
      f: '0'
    }
  },
  {
    id: 2,
    name: 'Espresso',
    sensors: {
      t: '53',
      p: '0',
      w: '310',
      f: '0'
    }
  },
  {
    id: 3,
    name: 'Mariage Frères',
    sensors: {
      t: '53',
      p: '0',
      w: '320',
      f: '0'
    }
  }
];

export const presetSettingOptionsMock: IPresetSetting[] = [
  {
    name: 'name: Filter 2.1',
    id: 1
  },
  {
    name: 'pressure',
    id: 2
  },
  {
    name: 'temperature: 86°c',
    id: 3
  },
  {
    name: 'stop weight',
    id: 4
  },
  {
    name: 'flow',
    id: 5
  },
  {
    name: 'pre-infusion',
    id: 6
  },
  {
    name: 'save',
    id: 7
  },
  {
    name: 'discard',
    id: 8
  }
];

export const dummyOptions = [
  {
    name: '',
    id: -2
  },
  {
    name: '',
    id: -1
  }
];

export const generateMockSetting = (name: string) => {
  return [
    {
      name: `name: ${name}`,
      id: 1
    },
    {
      name: 'pressure',
      id: 2
    },
    {
      name: 'temperature: 86°c',
      id: 3
    },
    {
      name: 'stop weight',
      id: 4
    },
    {
      name: 'flow',
      id: 5
    },
    {
      name: 'pre-infusion',
      id: 6
    },
    {
      name: 'save',
      id: 7
    },
    {
      name: 'discard',
      id: 8
    }
  ];
};
