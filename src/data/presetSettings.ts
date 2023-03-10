import { IPresetsSettingData } from './../types/index';

export const getPresetSettingsData = async () =>
  await window.meticulousAPI.getPresetSettingData();

export const setPresetSettingsData = async (presets: IPresetsSettingData[]) => {
  const json = JSON.stringify(presets);

  const response = await window.meticulousAPI.saveFile(
    './src/data/presetSettings.json',
    json
  );
  if (response) console.log('Oops, there was an error.');
  else console.log('The file has been saved!');
};
