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
  | 'doubleTare'
  | 'start'
  | ''
  | 'longTare'
  | 'longEncoder';

export type IPresetSettings = string[];

export interface ISensorData {
  time: string;
  name: StageType;
  sensors: {
    p: string; // Pressure - Bars
    t: string; // Temperature - degrees celsius
    w: string; // Weight - grams
    f: string; // Flow - ml/s
  };
  profile: string;
}

export interface IPreset {
  id: number;
  name: string;
  sensors: {
    p: string; // Pressure - Bars
    t: string; // Temperature - degrees celsius
    w: string; // Weight - grams
    f: string; // Flow - ml/s
  };
}

export type IPresetType =
  | 'name'
  | 'pressure'
  | 'temperature'
  | 'pre-infusion'
  | 'ratio'
  | 'dose'
  | 'purge'
  | 'save'
  | 'discard'
  | '';

export interface IPresetSetting {
  name: string;
  id: number;
  key: IPresetType;
}
