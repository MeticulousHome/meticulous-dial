type EnforceKeys<Key extends string, T extends Record<Key, unknown>> = {
  [K in keyof T as K extends Key ? K : never]?: T[K];
};

export type ActionType =
  | 'Home'
  | 'Scale'
  | 'Purge'
  | 'Tare'
  | 'Exit'
  | 'Start'
  | 'Stop'
  | '';

export type StageType =
  | 'idle'
  | 'preinfusion'
  | 'infusion'
  | 'purge'
  | 'tare'
  | 'home'
  | 'heating';

export type GestureType =
  | 'right'
  | 'left'
  | 'click'
  | 'doubleClick'
  | 'start'
  | '';

export type ISensor = EnforceKeys<ListSettings, PressetSettingStructure>;

export type ISensorData = {
  name: StageType; //stage name
  time: string;
  sensors: ISensor;
};

export interface IPreset {
  name: string; // preset name
  id: number;
  stage: StageType;
  time: string;
  sensors: ISensor;
}

export const settingKeys = ['p', 't', 'w', 'f'] as const;
export type ListSettings = (typeof settingKeys)[number];

export type PressetSettingStructure = {
  t: string;
  p: string;
  w: string;
  f: string;
};
