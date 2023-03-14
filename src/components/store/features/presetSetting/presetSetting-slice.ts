import {
  createAsyncThunk,
  createSlice,
  Draft,
  PayloadAction
} from '@reduxjs/toolkit';

import { IPresetSetting, IPresetsSettingData } from '../../../../types';
import {
  settingsDefaultNewPreset,
  dummyOptions
} from '../../../../utils/mock';
import {
  getPresetSettingsData,
  setPresetSettingsData
} from '../../../../data/presetSettings';
import { RootState } from '../../store';

export interface PresetSettingInterface {
  activeSetting: number;
  startIndex: number;
  endIndex: number;
  pending: boolean;
  error: boolean;
  settings: IPresetsSettingData;
  updatingSettings: IPresetsSettingData;
  allSettings: IPresetsSettingData[];
}
const initialState: PresetSettingInterface = {
  activeSetting: 2,
  startIndex: 2,
  endIndex: 0,
  pending: false,
  error: false,
  settings: {
    presetId: '-1',
    settings: []
  },
  updatingSettings: {
    presetId: '-1',
    settings: []
  },
  allSettings: []
};

export const getPresetSettings = createAsyncThunk(
  'presetSetting/getSettings',
  async () => {
    const presetSettingsData = await getPresetSettingsData();
    //find preset
    console.log('presetSettingsData', JSON.parse(presetSettingsData));
    return JSON.parse(presetSettingsData);
  }
);

export const savePresetSetting = createAsyncThunk(
  'presetSetting/saveSetting',
  async (presetSettings: IPresetsSettingData, { getState }) => {
    const state = getState() as RootState;
    const presetSettingState = state.presetSetting;

    const allSettings = [...presetSettingState.allSettings];
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
      console.log('allSettings', allSettings);
      await setPresetSettingsData(allSettings);
    }

    // return data;
    return { allSettings, presetSettings };
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
      action: PayloadAction<number>
    ) {
      const targetSetting = state.allSettings.find(
        (setting) => setting.presetId === action.payload.toString()
      );
      const settings = [...dummyOptions, ...targetSetting.settings];
      state.settings = { ...targetSetting, settings };
      state.updatingSettings = { ...targetSetting, settings };
      state.endIndex = settings.length - 1;
      // reset active setting
      // state.activeSetting = 2;
      return state;
    },
    discardSettings(state: Draft<typeof initialState>) {
      state.updatingSettings = state.settings;
      state.activeSetting = 2;
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
          action: PayloadAction<{
            allSettings: IPresetsSettingData[];
            presetSettings: IPresetsSettingData;
          }>
        ) => {
          state.pending = false;
          state.error = false;
          // state.settings = action.payload;
          // state.endIndex = action.payload.length + 1;
          state.allSettings = action.payload.allSettings;
          state.settings = action.payload.presetSettings;
          state.updatingSettings = action.payload.presetSettings;
          state.activeSetting = 2;
        }
      )
      .addCase(
        savePresetSetting.rejected,
        (state: PresetSettingInterface, action: any) => {
          state.pending = false;
          state.error = true;
          state.endIndex = 0;
          state.activeSetting = 0;
          console.log('savePresetSetting.rejected', action);
        }
      )
      .addCase(getPresetSettings.pending, (state: PresetSettingInterface) => {
        state.pending = true;
        state.error = false;
      })
      .addCase(
        getPresetSettings.fulfilled,
        (
          state: PresetSettingInterface,
          action: PayloadAction<IPresetsSettingData[]>
        ) => {
          state.pending = false;
          state.error = false;
          state.allSettings = action.payload;
          // reset active setting
          // state.activeSetting = 2;
        }
      )
      .addCase(
        getPresetSettings.rejected,
        (state: PresetSettingInterface, action: any) => {
          console.log('getPresetSettings.rejected', action);
          state.pending = false;
          state.error = true;
          state.endIndex = 0;
          state.activeSetting = 0;
        }
      );
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
