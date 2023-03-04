import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

import { IPreset } from '../../../../types/index';
import presetsData from '../../../../data/presets.json';

interface GesturesState {
  value: IPreset[];
  activePresetIndex: number;
  activePreset: IPreset;
  pending: boolean;
  error: boolean;
}

const initialState: GesturesState = {
  value: presetsData,
  activePresetIndex: -1,
  activePreset: {
    id: -1,
    name: '',
    sensors: {
      t: '0',
      p: '0',
      w: '0',
      f: '0'
    },
    time: ''
  },
  pending: false,
  error: false
};

const presetSlice = createSlice({
  name: 'presets',
  initialState,
  reducers: {
    setActivePreset: (state: GesturesState, action: PayloadAction<number>) => {
      state.activePresetIndex = action.payload;
    },
    nextPreset: (state: GesturesState) => {
      if (state.activePresetIndex < state.value.length) {
        const newActivePresetIndex = state.activePresetIndex + 1;
        state.activePresetIndex = newActivePresetIndex;
        if (newActivePresetIndex < state.value.length) {
          state.activePreset = state.value[newActivePresetIndex];
        }
      }
    },
    prevPreset: (state: GesturesState) => {
      if (state.activePresetIndex > 0) {
        const newActivePresetIndex = state.activePresetIndex - 1;
        state.activePresetIndex = newActivePresetIndex;
        state.activePreset = state.value[newActivePresetIndex];
      }
    },
    setPresets: (state: GesturesState, action: PayloadAction<IPreset[]>) => {
      state.value = action.payload;
      if (action.payload[0]) {
        state.activePreset = action.payload[0];
      }
    },
    addNewPreset: (state: GesturesState) => {
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
