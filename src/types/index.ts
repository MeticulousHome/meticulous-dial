import { VariableType } from '@meticulous-home/espresso-profile';
import { Settings } from '@meticulous-home/espresso-api';
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
  | 'singleTare'
  | 'longTare'
  | 'longEncoder'
  | 'pressDown'
  | 'pressUp';

export type IPresetSettings = string[];

export interface ISensorData {
  time: number;
  name: StageType | string;
  waitingForActionAlreadySent: boolean;
  sensors: {
    p: number; // Pressure - Bars
    t: number; // Temperature - degrees celsius
    w: number; // Weight - grams
    f: number; // Flow - ml/s
  };
  setpoints: {
    active?: string;
    temperature?: number;
    flow?: number;
    pressure?: number;
    power?: number;
    piston?: number;
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

export type OutputKey = 'output';

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

export type PresetOnOff = {
  type: 'on-off';
  value: string;
};

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
  | ActionKey
  | '';

export type ISettingType = PressureKey | TemperatureKey | OutputKey;

type SettingsKeys = 'key' | 'value';
export interface PressetSettings {
  name: string;
  settings: Record<SettingsKeys, string | number>[];
}

export type SettingsItem = {
  value?: number | string | boolean;
  key: string;
  label?: string;
  getLabel?: (settings: Settings) => string;
  shortLabel?: string;
  visible?: boolean;
  hasSeparator?: boolean;
};

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
