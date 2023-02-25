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

export type IPressetSettingTextKey = 'name';

export type IPresetSettingOnOffKey = 'pre-infusion';

export type IPressetSettingMultipleOptionKey = 'ratio' | 'purge';

export type IPressetSettingActionKey = 'save' | 'discard';

export type IPresetSettingsNumericalTemperatureKey = 'temperature';

export type IPresetSettingsNumericalPressureKey = 'pressure';

export type IPresetSettingsNumericalDoseKey = 'dose';

export interface IBasicPressetSetting {
  id: number;
  label: string;
  value?: number | string;
}

export interface IPressetSettingNumerical extends IBasicPressetSetting {
  type: 'numerical';
}

export interface IPresetSettingsNumericalTemperature
  extends IPressetSettingNumerical {
  key: IPresetSettingsNumericalTemperatureKey;
  unit: '°c';
}

export interface IPresetSettingsNumericalPressure
  extends IPressetSettingNumerical {
  key: IPresetSettingsNumericalPressureKey;
  unit: 'bar';
}

export interface IPresetSettingsNumericalDose extends IPressetSettingNumerical {
  key: IPresetSettingsNumericalDoseKey;
  unit: 'g';
}

export interface IPressetSettingText extends IBasicPressetSetting {
  type: 'text';
  key: IPressetSettingTextKey;
}

export interface IPresetSettingOnOff extends IBasicPressetSetting {
  type: 'on-off';
  key: IPresetSettingOnOffKey;
}

export interface IPressetSettingMultipleOption extends IBasicPressetSetting {
  type: 'multiple-option';
  key: IPressetSettingMultipleOptionKey;
}

export interface IPressetSettingAction extends IBasicPressetSetting {
  type: 'action';
  key: IPressetSettingActionKey;
}

export type IPresetSetting =
  | IPressetSettingText
  | IPresetSettingsNumericalTemperature
  | IPresetSettingsNumericalPressure
  | IPresetSettingsNumericalDose
  | IPresetSettingOnOff
  | IPressetSettingMultipleOption
  | IPressetSettingAction;

export type IPresetType =
  | IPressetSettingTextKey
  | IPresetSettingOnOffKey
  | IPressetSettingMultipleOptionKey
  | IPressetSettingActionKey
  | IPresetSettingsNumericalTemperatureKey
  | IPresetSettingsNumericalPressureKey
  | IPresetSettingsNumericalDoseKey
  | '';
