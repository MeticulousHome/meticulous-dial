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

export interface ISensorData {
  time: string;
  name: StageType;
  sensors: {
    pressure: string; // Pressure - Bars
    temp: string; // Temperature - degrees celsius
    weight: string; // Weight - grams
    flow: string; // Flow - ml/s
  };
}
