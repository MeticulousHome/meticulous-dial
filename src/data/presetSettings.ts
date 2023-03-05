import { IPresetsSettingData } from './../types/index';
import presetSettingsData from './presetSettings.json';

export const getPresetSettingsData =
  presetSettingsData as IPresetsSettingData[];

export const setPresetSettingsData = async (presets: IPresetsSettingData[]) => {
  const json = JSON.stringify(presets);

  const response = await window.meticulousAPI.saveFile(
    './src/data/presetSettings.json',
    json
  );
  if (response) console.log('Oops, there was an error.');
  else console.log('The file has been saved!');
};
