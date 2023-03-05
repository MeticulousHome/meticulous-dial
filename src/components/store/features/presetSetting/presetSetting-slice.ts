import {
  createAsyncThunk,
  createSlice,
  Draft,
  PayloadAction
} from '@reduxjs/toolkit';

import { IPresetSetting, IPresetsSettingData } from '../../../../types';
import { getPresetsData, setPresetsData } from '../../../../data/presets';
import { dummyOptions } from '../../../../utils/mock';
import {
  settingsDefaultNewPreset
} from '../../../../utils/mock';
import {
  getPresetSettingsData,
  setPresetSettingsData
} from './../../../../data/presetSettings';

export interface PresetSettingInterface {
  activeSetting: number;
  startIndex: number;
  endIndex: number;
  pending: boolean;
  error: boolean;
  settings: IPresetsSettingData;
  updatingSettings: IPresetsSettingData;
}
const initialState: PresetSettingInterface = {
  activeSetting: 2,
  startIndex: 2,
  endIndex: getPresetSettingsData.length + 1,
  pending: false,
  error: false,
  settings: {
    presetId: '-1',
    settings: []
  },
  updatingSettings: {
    presetId: '-1',
    settings: []
  }
};

export const savePresetSetting = createAsyncThunk(
  'presetSetting/saveSetting',
  async (presetSettings: IPresetsSettingData) => {
    const data = [...getPresetSettingsData];
    const index = data.findIndex(
      (preset) => preset.presetId === presetSettings.presetId
    );
    if (index > -1) {
      data[index] = {
        ...presetSettings,
        settings: presetSettings.settings.filter((setting) => setting.id > -1)
      };
    }

    const presetsData = [...getPresetsData];

    const targetIndex = presetsData.findIndex(
      (preset) => preset.id === parseInt(presetSettings.presetId)
    );

    if (targetIndex > -1) {
      const newName =
        presetSettings.settings.find((setting) => setting.key === 'name')
          ?.value || data[targetIndex].name;
      presetsData[targetIndex] = {
        ...presetsData[targetIndex],
        name: newName
      };
    }
    await setPresetSettingsData(data);
    await setPresetsData(presetsData);

    return data;
  }
);

const presetSettingSlice = createSlice({
  name: 'presetSettings',
  initialState: initialState,
  reducers: {
    updatePresetSetting: (
      state: Draft<typeof initialState>,
      action: PayloadAction<IPresetSetting>
    ) => {
      state.updatingSettings.settings = state.updatingSettings.settings.map(
        (setting) =>
          setting.id === action.payload.id ? action.payload : setting
      );
    },
    setActiveSetting: (
      state: Draft<typeof initialState>,
      action: PayloadAction<number>
    ) => {
      state.activeSetting = action.payload;
      return state;
    },
    setNextSettingOption: (state: Draft<typeof initialState>) => {
      const nextActiveSetting = state.activeSetting + 1;
      if (nextActiveSetting > state.endIndex) {
        return;
      }
      state.activeSetting = nextActiveSetting;
      return state;
    },
    setPrevSettingOption: (state: Draft<typeof initialState>) => {
      const nextActiveSetting = state.activeSetting - 1;
      if (nextActiveSetting < state.startIndex) {
        return;
      }
      state.activeSetting = nextActiveSetting;
      return state;
    },
    resetActiveSetting: (state: Draft<typeof initialState>) => {
      state.activeSetting = 2;
      return state;
    },
    setEndIndex: (
      state: Draft<typeof initialState>,
      action: PayloadAction<number>
    ) => {
      state.activeSetting = 2;
      state.endIndex = action.payload;
      return state;
    },
    setDefaultSettingsNewPreset: (state: Draft<typeof initialState>) => {
      state.activeSetting = 2;
      state.endIndex = settingsDefaultNewPreset.length + 1;
      state.settings = settingsDefaultNewPreset;
    },
    setSettings(
      state: Draft<typeof initialState>,
      action: PayloadAction<IPresetsSettingData>
    ) {
      const settings = [...dummyOptions, ...action.payload.settings];
      state.settings = { ...action.payload, settings };
      state.updatingSettings = { ...action.payload, settings };
      state.endIndex = settings.length + 1;
      // reset active setting
      state.activeSetting = 2;
      return state;
    },
    discardSettings(state: Draft<typeof initialState>) {
      state.updatingSettings = state.settings;
      return state;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(savePresetSetting.pending, (state: PresetSettingInterface) => {
        state.pending = true;
        state.error = false;
      })
      .addCase(
        savePresetSetting.fulfilled,
        (
          state: PresetSettingInterface,
          _action: PayloadAction<IPresetsSettingData[]>
        ) => {
          state.pending = false;
          state.error = false;
          // state.settings = action.payload;
          // state.endIndex = action.payload.length + 1;
          state.activeSetting = 2;
        }
      )
      .addCase(savePresetSetting.rejected, (state: PresetSettingInterface) => {
        state.pending = false;
        state.error = true;
        state.endIndex = 0;
        state.activeSetting = 0;
      });
  }
});

export const {
  updatePresetSetting,
  setActiveSetting,
  setNextSettingOption,
  setPrevSettingOption,
  resetActiveSetting,
  setEndIndex,
  setDefaultSettingsNewPreset,
  setSettings,
  discardSettings
} = presetSettingSlice.actions;

export default presetSettingSlice.reducer;
