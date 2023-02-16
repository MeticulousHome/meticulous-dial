import { createSlice, PayloadAction, Draft } from '@reduxjs/toolkit';

export interface PresetSettingInterface {
  activeSetting: number;
  startIndex: number;
  endIndex: number;
}
const initialState: PresetSettingInterface = {
  activeSetting: 2,
  startIndex: 2,
  endIndex: 8
};

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
    }
  }
});

export const {
  setActiveSetting,
  setNextSettingOption,
  setPrevSettingOption,
  resetActiveSetting
} = presetSettingSlice.actions;

export default presetSettingSlice.reducer;
