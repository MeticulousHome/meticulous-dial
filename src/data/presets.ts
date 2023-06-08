import { IPreset } from './../types/index';

export const getPresetsData = async () => {
  if (!window.meticulousAPI?.getPresetSettingData) {
    const { presetsMock } = await import('./mock_presets');
    return JSON.stringify(presetsMock);
  }

  const data = await window.meticulousAPI.getPresetData();
  return data;
};

export const setPresetsData = async (presets: IPreset[]) => {
  if (!window.meticulousAPI?.saveFile) {
    // TODO: We can implement local store
    console.log(`Can't save file in browser.`);
    return;
  }
  const json = JSON.stringify(presets);
  const response = await window.meticulousAPI.saveFile('presets.json', json);

  if (response) console.log('Oops, there was an error.');
  else console.log('The file has been saved!');
};
