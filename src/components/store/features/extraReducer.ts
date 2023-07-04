import { createAsyncThunk } from '@reduxjs/toolkit';
import { IPreset, IPresetsSettingData } from '../../../types';
import { RootState } from '../store';
import { getPresetsData } from '../../../data/presets';

export const savePresetSetting = createAsyncThunk(
  'preset/saveSetting',
  async (presetSettings: IPresetsSettingData, { getState }) => {
    const state = getState() as RootState;

    const allSettings = [...state.presets.allSettings];
    const index2 = allSettings.findIndex(
      (setting) => setting.presetId === presetSettings.presetId
    );

    if (index2 > -1) {
      allSettings[index2] = {
        ...presetSettings,
        settings: presetSettings.settings.filter(
          (setting) => setting.id !== -1 && setting.id !== -2
        )
      };
    }

    // return data;
    return { allSettings, presetSettings };
  }
);

export const getPresets = createAsyncThunk('presetData/getData', async () => {
  const presetsData = await getPresetsData();

  return JSON.parse(presetsData) as IPreset[];
});
