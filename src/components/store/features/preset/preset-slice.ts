import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { MockPresets } from '../../../../utils/mock';

import { IPreset, MockPreset } from '../../../../types/index';

interface GesturesState {
  value: IPreset[];
  activePresetIndex: number;
  activePreset: IPreset;
}

const initialState: GesturesState = {
  value: [],
  activePresetIndex: 0,
  activePreset: null
};

export const fetchPreset = createAsyncThunk(
  'users/fetchByIdStatus',
  async () => {
    const response: any = await new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            data: MockPresets
          }),
        300
      )
    );
    return response.data;
  }
);

const presetSlice = createSlice({
  name: 'presets',
  initialState,
  reducers: {
    setActivePreset: (state: GesturesState, action: PayloadAction<number>) => {
      state.activePresetIndex = action.payload;
    },
    nextPreset: (state: GesturesState) => {
      if (state.activePresetIndex < state.value.length - 1) {
        const newActivePresetIndex = state.activePresetIndex + 1;
        state.activePresetIndex = newActivePresetIndex;
        state.activePreset = state.value[newActivePresetIndex];
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
    }
  },
  extraReducers: (builder) => {
    builder.addCase(
      fetchPreset.fulfilled,
      (state: GesturesState, action: PayloadAction<IPreset[]>) => {
        state.value = action.payload;
        if (action.payload[0]) {
          state.activePreset = action.payload[0];
        }
      }
    );
  }
});

export const { setActivePreset, nextPreset, prevPreset, setPresets } =
  presetSlice.actions;
export default presetSlice.reducer;
