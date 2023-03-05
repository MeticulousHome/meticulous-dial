import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { getPresetsData } from '../../../../data/presets';
import { IPreset } from '../../../../types/index';

interface PresetsState {
  value: IPreset[];
  activePresetIndex: number;
  activePreset: IPreset;
  pending: boolean;
  error: boolean;
}

const initialState: PresetsState = {
  value: getPresetsData,
  activePresetIndex: getPresetsData.findIndex((preset) => preset.isDefault),
  activePreset:
    getPresetsData.find((preset) => preset.isDefault) || getPresetsData[0],
  pending: false,
  error: false
};

const presetSlice = createSlice({
  name: 'presets',
  initialState,
  reducers: {
    setActivePreset: (state: PresetsState, action: PayloadAction<number>) => {
      state.activePresetIndex = action.payload;
    },
    nextPreset: (state: PresetsState) => {
      if (state.activePresetIndex < state.value.length - 1) {
        const newActivePresetIndex = state.activePresetIndex + 1;
        state.activePresetIndex = newActivePresetIndex;
        if (newActivePresetIndex < state.value.length) {
          state.activePreset = state.value[newActivePresetIndex];
        }
      }
    },
    prevPreset: (state: PresetsState) => {
      if (state.activePresetIndex > 0) {
        const newActivePresetIndex = state.activePresetIndex - 1;
        state.activePresetIndex = newActivePresetIndex;
        state.activePreset = state.value[newActivePresetIndex];
      }
    },
    setPresets: (state: PresetsState, action: PayloadAction<IPreset[]>) => {
      state.value = action.payload;
      if (action.payload[0]) {
        state.activePreset = action.payload[0];
      }
    },
    addNewPreset: (state: PresetsState) => {
      state.value.push({
        id: state.value.length + 1,
        name: 'New Preset',
        sensors: {
          t: '0',
          p: '0',
          w: '0',
          f: '0'
        },
        time: ''
      });
      state.activePresetIndex = state.value.length - 1;
      state.activePreset = state.value[state.activePresetIndex];
    }
  }
});

export const {
  setActivePreset,
  nextPreset,
  prevPreset,
  setPresets,
  addNewPreset
} = presetSlice.actions;
export default presetSlice.reducer;
