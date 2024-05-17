import { IPreset } from './../types/index';

export const getPresetsData = async () =>
  await window.meticulousAPI.getPresetData();

export const setPresetsData = async (presets: IPreset[]) => {
  const json = JSON.stringify(presets);
  const response = await window.meticulousAPI.saveFile('presets.json', json);

  if (response) console.log('Oops, there was an error.');
  else console.log('The file has been saved!');
};

export const saveProfileIndex = async (index: number | string) => {
  const res = await window.meticulousAPI.saveProfileIndex(
    'defaultPresetIndex.txt',
    index.toString()
  );

  if (res) console.log('Oops, there was an error.');
  else console.log('The file has been saved!');
};

export const getProfileIndex = async () =>
  await window.meticulousAPI.getProfileIndex();
