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

export type MockPreset = {
  name: string;
};

export interface ISensor {
  p: string; // Pressure - Bars
  t: string; // Temperature - degrees celsius
  w: string; // Weight - grams
  f: string; // Flow - ml/s
}

export interface ISensorData {
  time: string;
  name: StageType;
  sensors: ISensor;
}

export interface IPreset {
  name: string;
  id: number;
  stage: StageType;
  time: string;
  sensors: ISensor & {
    time: number;
  };
}
