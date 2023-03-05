import { IPreset } from './../types/index';
import presetsData from './presets.json';

export const getPresetsData = presetsData;

export const setPresetsData = async (presets: IPreset[]) => {
  const json = JSON.stringify(presets);
  const response = await window.meticulousAPI.saveFile(
    './src/data/presets.json',
    json
  );

  if (response) console.log('Oops, there was an error.');
  else console.log('The file has been saved!');
};
