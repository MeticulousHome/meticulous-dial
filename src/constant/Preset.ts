import { ISensor, ListSettings } from '../types';

//enum preset settings
export const PresetSettingString: Record<ListSettings, string> = {
  p: 'pressure',
  t: 'temperature',
  w: 'weight',
  f: 'flow'
};

export const PresetSettingInit: { id: number; name: ListSettings | '' }[] = [
  {
    id: -1,
    name: ''
  },
  {
    id: -2,
    name: ''
  }
];
