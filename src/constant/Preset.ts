//enum preset settings
export const PresetSettingString: Record<string, string> = {
  p: 'pressure',
  t: 'temperature',
  w: 'weight',
  f: 'flow',
  pre_fusion: 'pre-fusion'
};

export const PresetSettingInit: { id: number; name: string | '' }[] = [
  {
    id: -1,
    name: ''
  },
  {
    id: -2,
    name: ''
  }
];
