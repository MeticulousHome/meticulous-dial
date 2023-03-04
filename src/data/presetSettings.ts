import { IPresetSetting } from './../types/index';
import presetSettingsData from './presetSettings.json';

export const getPresetSettingsData = presetSettingsData as IPresetSetting[];

export const setPresetSettingsData = async (presets: IPresetSetting[]) => {
  const json = JSON.stringify(presets);
  const response = await window.meticulousAPI.saveFile(
    './data/presetSettings.json',
    json
  );

  if (response) console.log('Oops, there was an error.');
  else console.log('The file has been saved!');
};
