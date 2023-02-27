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
  | 'initialize'
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
  time: string;
}

export interface IBasePresset {
  id: number;
  label: string;
}
export type NameKey = 'name';

export type PressureKey = 'pressure';

export type TemperatureKey = 'temperature';

export type DoseKey = 'dose';

export type RatioKey = 'ratio';

export type PurgeKey = 'purge';

export type PreInfusionKey = 'pre-infusion';

export type ActionKey = 'save' | 'discard';

export type IPresetText = {
  type: 'text';
  value: string;
};
export type PresetName = IPresetText & { key: NameKey };
export interface IPresetName extends IBasePresset, PresetName {}

export type IPresetBaseNumerical = {
  type: 'numerical';
  value: number;
};
export interface IPresetNumericalPressure
  extends IBasePresset,
    IPresetBaseNumerical {
  key: PressureKey;
  unit: 'bar';
}
export interface IPresetNumericalTemperature
  extends IBasePresset,
    IPresetBaseNumerical {
  key: TemperatureKey;
  unit: '°c';
}
export interface IPresetNumericalDose
  extends IBasePresset,
    IPresetBaseNumerical {
  key: DoseKey;
  unit: 'g';
}
export type IPresetMultipleOption = {
  type: 'multiple-option';
  value: string;
};
export type PresetMultipleOptionRatio = IPresetMultipleOption & {
  key: RatioKey;
};
export interface IPresetMultipleOptionRatio
  extends IBasePresset,
    PresetMultipleOptionRatio {}

export type PresetMultipleOptionPurge = IPresetMultipleOption & {
  key: PurgeKey;
};
export interface IPresetMultipleOptionPurge
  extends IBasePresset,
    PresetMultipleOptionPurge {}

export type PresetOnOff = {
  type: 'on-off';
  value: string;
};

export type PresetOnOffPreinfusion = PresetOnOff & { key: PreInfusionKey };
export interface IPresetOnOffPreinfusion
  extends IBasePresset,
    PresetOnOffPreinfusion {}

export type PresetAction = {
  type: 'action';
  key: ActionKey;
};
export interface IPresetAction extends IBasePresset, PresetAction {}

export type IPresetSetting =
  | IPresetName
  | IPresetNumericalPressure
  | IPresetNumericalTemperature
  | IPresetNumericalDose
  | IPresetMultipleOptionRatio
  | IPresetMultipleOptionPurge
  | IPresetOnOffPreinfusion
  | IPresetAction;

export type IPresetType =
  | NameKey
  | PressureKey
  | TemperatureKey
  | DoseKey
  | RatioKey
  | PurgeKey
  | PreInfusionKey
  | ActionKey
  | '';
