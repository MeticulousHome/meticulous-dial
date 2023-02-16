import {
  createSlice,
  PayloadAction,
  Draft,
  createAsyncThunk
} from '@reduxjs/toolkit';
import { IPresetSetting } from '../../../..//types';
import {
  generateMockSetting,
  presetSettingOptionsMock
} from '../../../../utils/mock';

export interface PresetSettingInterface {
  activeSetting: number;
  startIndex: number;
  endIndex: number;
  pending: boolean;
  error: boolean;
  settings: IPresetSetting[];
}
const initialState: PresetSettingInterface = {
  activeSetting: 0,
  startIndex: 2,
  endIndex: 0,
  pending: false,
  error: false,
  settings: []
};

export const fetchPresetSetting = createAsyncThunk(
  'presetSetting/fetchSetting',
  async (name?: string) => {
    const response: any = await new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            data: generateMockSetting(name || '')
          }),
        300
      )
    );
    return response.data;
  }
);

const presetSettingSlice = createSlice({
  name: 'presetSettings',
  initialState: initialState,
  reducers: {
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
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPresetSetting.pending, (state: PresetSettingInterface) => {
        state.pending = true;
        state.error = false;
        state.settings = [];
        state.activeSetting = 0;
      })
      .addCase(
        fetchPresetSetting.fulfilled,
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
      .addCase(fetchPresetSetting.rejected, (state: PresetSettingInterface) => {
        state.pending = false;
        state.error = true;
        state.endIndex = 0;
        state.activeSetting = 0;
      });
  }
});

export const {
  setActiveSetting,
  setNextSettingOption,
  setPrevSettingOption,
  resetActiveSetting,
  setEndIndex
} = presetSettingSlice.actions;

export default presetSettingSlice.reducer;
