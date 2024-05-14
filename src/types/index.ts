export * from './wifi';

import { DashboardProfile, ItalianProfile } from '../constants';

interface JSONObject {
  [x: string]: JSONValue;
}

export type JSONValue =
  | string
  | number
  | boolean
  | JSONObject
  | Array<JSONValue>;

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
  | 'doubleClick'
  | 'context'
  | 'start'
  | 'longTare'
  | 'longEncoder'
  | 'pressDown'
  | 'pressUp';

export type IPresetSettings = string[];

export interface ISensorData {
  time: string;
  name: StageType;
  waitingForActionAlreadySent: boolean;
  sensors: {
    p: string; // Pressure - Bars
    t: string; // Temperature - degrees celsius
    w: string; // Weight - grams
    f: string; // Flow - ml/s
  };
  profile: string;
  waterStatus: boolean;
}

export interface IPreset {
  id: string;
  name: string;
  kind?: ItalianProfile | DashboardProfile;
  isDefault?: boolean;
  settings?: IPresetSetting[];
  dashboard?: any;
  image?: string;
  borderColor?: string;
}

export interface IBasePresset {
  id: number;
  label: string;
  hidden?: boolean;
}
export type NameKey = 'name';

export type PressureKey = 'pressure' | 'pressure_1' | 'pressure_2';

export type TemperatureKey = 'temperature';

export type DoseKey = 'dose';

export type RatioKey = 'ratio';

export type PurgeKey = 'purge';

export type OutputKey = 'output';

export type PreInfusionKey = 'pre-infusion';

export type PreHeatKey = 'pre-heat';

export type ActionKey = 'save' | 'discard' | 'delete';

export type IPresetText = {
  type: 'text';
  value: string;
};
export type PresetName = IPresetText & { key: NameKey };
export interface IPresetName extends IBasePresset, PresetName {}

export type IPresetBaseNumerical = {
  type: 'numerical';
  value: number | number[][];
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

export interface IPresetNumericalOutput
  extends IBasePresset,
    IPresetBaseNumerical {
  key: OutputKey;
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

export type PresetOnOffPreHeat = PresetOnOff & { key: PreHeatKey };

export interface IPresetOnOffPreinfusion
  extends IBasePresset,
    PresetOnOffPreinfusion {}

export interface IPresetOnOffPreheat extends IBasePresset, PresetOnOffPreHeat {}

export type PresetAction = {
  type: 'action';
  key: ActionKey;
};
export interface IPresetAction extends IBasePresset, PresetAction {
  value?: string;
}

export type IPresetSetting =
  | IPresetName
  | IPresetNumericalPressure
  | IPresetNumericalTemperature
  | IPresetNumericalDose
  | IPresetNumericalOutput
  | IPresetMultipleOptionRatio
  | IPresetMultipleOptionPurge
  | IPresetOnOffPreinfusion
  | IPresetOnOffPreheat
  | IPresetAction;

export interface IPresetsSettingData {
  presetId: string;
  settings: IPresetSetting[];
}

export type IPresetType =
  | NameKey
  | PressureKey
  | TemperatureKey
  | OutputKey
  | RatioKey
  | PurgeKey
  | PreInfusionKey
  | PreHeatKey
  | ActionKey
  | '';

export type ISettingType =
  | PressureKey
  | TemperatureKey
  | OutputKey
  | PreHeatKey
  | PreInfusionKey;

// type SettingsKeys = 'key' | 'value';
export interface PressetSettings {
  id: string;
  name: string;
  settings: IPresetSetting[];
}

export type Actions = 'to_play';

export interface IItalian {
  action: Actions;
  name: string;
  automatic_purge: boolean;
  temperature: number;
  preinfusion: boolean;
  preheat: boolean;
  pressure: number;
  out_weight: number;
  source: 'lcd';
  kind: ItalianProfile;
}

export interface SettingsItem {
  type: string;
  values?: any;
  value: any;
  visible: boolean;
}

export enum YesNoEnum {
  Yes = 'yes',
  No = 'no'
}
