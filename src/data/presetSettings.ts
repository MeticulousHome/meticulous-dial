import { IPresetsSettingData } from './../types/index';

export const getPresetSettingsData = async (): Promise<string> => {
  if (!window.meticulousAPI?.getPresetSettingData) {
    const { presetSettingsMock } = await import('./mock_presetSettings');
    return JSON.stringify(presetSettingsMock);
  }

  return await window.meticulousAPI.getPresetSettingData();
};

export const setPresetSettingsData = async (
  presets: IPresetsSettingData[]
): Promise<void> => {
  const json = JSON.stringify(presets);
  console.log('HEY!');
  if (!window.meticulousAPI?.saveFile) {
    // TODO: We can implement local store
    console.log(`Can't save file in browser.`);
    return;
  }

  const response = await window.meticulousAPI.saveFile(
    'presetSettings.json',
    json
  );

  if (response) console.log('Oops, there was an error.');
  else console.log('The file has been saved!');
};
