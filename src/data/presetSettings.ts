import { DEFAULT_SETTING } from '../constants/Setting';
import { IPresetsSettingData } from './../types/index';

const removeSettingActions = (target: IPresetsSettingData) => {
  // remove last 3 item in settings
  const settingWithoutActions: IPresetsSettingData = {
    ...target,
    settings: target.settings.slice(0, -1 * DEFAULT_SETTING.length)
  };
  return settingWithoutActions;
};

export const getPresetSettingsData = async () =>
  await window.meticulousAPI.getPresetSettingData();

export const setPresetSettingsData = async (presets: IPresetsSettingData[]) => {
  const formatPresets = presets.map((preset) => removeSettingActions(preset));

  const json = JSON.stringify(formatPresets);

  const response = await window.meticulousAPI.saveFile(
    'presetSettings.json',
    json
  );
  if (response) console.log('Oops, there was an error.');
  else console.log('The file has been saved!');
};
