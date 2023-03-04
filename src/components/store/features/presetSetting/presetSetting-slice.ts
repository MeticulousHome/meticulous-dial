import {
  createSlice,
  PayloadAction,
  Draft,
  createAsyncThunk
} from '@reduxjs/toolkit';
import { IPresetSetting } from '../../../..//types';
import {
  settingsDefaultNewPreset
} from '../../../../utils/mock';
import {
  getPresetSettingsData,
  setPresetSettingsData
} from './../../../../data/presetSettings';
import { dummyOptions } from '../../../../utils/mock';

export interface PresetSettingInterface {
  activeSetting: number;
  startIndex: number;
  endIndex: number;
  pending: boolean;
  error: boolean;
  settings: IPresetSetting[];
  updatingSettings: IPresetSetting[];
}
const initialState: PresetSettingInterface = {
  activeSetting: 2,
  startIndex: 2,
  endIndex: getPresetSettingsData.length + 1,
  pending: false,
  error: false,
  settings: [...dummyOptions, ...getPresetSettingsData],
  updatingSettings: [...dummyOptions, ...getPresetSettingsData]
};

export const savePresetSetting = createAsyncThunk(
  'presetSetting/saveSetting',
  async (presetSettings: IPresetSetting[]) => {
    await setPresetSettingsData(presetSettings);
    return presetSettings;
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
      state.updatingSettings = state.updatingSettings.map((setting) =>
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
          action: PayloadAction<IPresetSetting[]>
        ) => {
          state.pending = false;
          state.error = false;
          state.settings = action.payload;
          state.endIndex = action.payload.length + 1;
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
  setDefaultSettingsNewPreset
} = presetSettingSlice.actions;

export default presetSettingSlice.reducer;
