import { VariableType } from '@meticulous-home/espresso-profile';

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
  name: StageType | string;
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
  id: number;
  name: string;
  isDefault?: boolean;
  settings?: IPresetSetting[];
  image?: string;
  borderColor?: string;
}

export interface IBasePresset {
  id: number;
  isInternal: boolean;
  externalType?: VariableType;
  label: string;
  hidden?: boolean;
}
export type NameKey = 'name';

export type ImageKey = 'image';

export type PressureKey = 'pressure';

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

export type IPresetImage = {
  type: 'image';
  value: string;
};

export type PresetName = IPresetText & { key: NameKey };
export type PresetImage = IPresetImage & { key: ImageKey };
export interface IPresetName extends IBasePresset, PresetName {}
export interface IProfilePresetImage extends IBasePresset, PresetImage {}

export type IPresetBaseNumerical = {
  type: 'numerical';
  value: number | number[][];
};

export interface IPresetNumericalUnit extends IPresetBaseNumerical {
  unit: string;
}

export interface IPresetNumericalPressure
  extends IBasePresset,
    IPresetNumericalUnit {
  key: PressureKey;
  unit: 'bar';
}
export interface IPresetNumericalTemperature
  extends IBasePresset,
    IPresetNumericalUnit {
  key: TemperatureKey;
  unit: '°c';
}
export interface IPresetNumericalDose
  extends IBasePresset,
    IPresetNumericalUnit {
  key: DoseKey;
  unit: 'g';
}

export interface IPresetNumericalOutput
  extends IBasePresset,
    IPresetNumericalUnit {
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
  | IPresetAction
  | IProfilePresetImage;

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

type SettingsKeys = 'key' | 'value';
export interface PressetSettings {
  name: string;
  settings: Record<SettingsKeys, string | number>[];
}

export interface SettingsItem {
  value?: number | string | boolean;
  key: string;
  label?: string;
  visible?: boolean;
}

export enum YesNoEnum {
  Yes = 'yes',
  No = 'no'
}

export type ProfileCause =
  | 'create'
  | 'update'
  | 'delete'
  | 'full_reload'
  | 'load';
