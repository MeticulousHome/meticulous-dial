import { IPreset } from '../types/index';

export const MockPresets: IPreset[] = [
  {
    id: 1,
    name: 'Filter 2.1',
    stage: 'idle',
    time: '5',
    sensors: {
      t: '53',
      p: '0',
      w: '300',
      f: '0',
      time: 0
    }
  },
  {
    id: 2,
    name: 'Espresso',
    stage: 'purge',
    time: '3',
    sensors: {
      t: '53',
      p: '0',
      w: '310',
      f: '0',
      time: 0
    }
  },
  {
    id: 3,
    name: 'Mariage Frères',
    stage: 'home',
    time: '60',
    sensors: {
      t: '53',
      p: '0',
      w: '320',
      f: '0',
      time: 0
    }
  }
];
