import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { MockPreset } from '../../../../types/index';

interface GesturesState {
  value: MockPreset[];
  activePreset: number;
}

const initialState: GesturesState = {
  value: [
    {
      name: 'Filter 2.1'
    },
    {
      name: 'Maria'
    },
    {
      name: 'Espresso'
    }
  ],
  activePreset: -1
};

const presetSlice = createSlice({
  name: 'presets',
  initialState,
  reducers: {
    setActivePreset: (state: GesturesState, action: PayloadAction<number>) => {
      state.activePreset = action.payload;
    },
    nextPreset: (state: GesturesState) => {
      if (state.activePreset === -1) {
        state.activePreset = 1;
        return;
      }
      if (state.activePreset < state.value.length - 1) {
        state.activePreset = state.activePreset + 1;
      }
    },
    prevPreset: (state: GesturesState) => {
      if (state.activePreset > 0) {
        state.activePreset = state.activePreset - 1;
      }
    }
  }
});

export const { setActivePreset, nextPreset, prevPreset } = presetSlice.actions;
export default presetSlice.reducer;
