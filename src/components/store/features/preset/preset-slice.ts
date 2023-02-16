import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { MockPresets } from '../../../../utils/mock';

import { IPreset } from '../../../../types/index';

interface GesturesState {
  value: IPreset[];
  activePresetIndex: number;
  activePreset: IPreset;
  pending: boolean;
  error: boolean;
}

const initialState: GesturesState = {
  value: [],
  activePresetIndex: -1,
  activePreset: null,
  pending: false,
  error: false
};

export const fetchPreset = createAsyncThunk(
  'users/fetchByIdStatus',
  async () => {
    // throw new Error('Error');
    const response: any = await new Promise((resolve) => {
      setTimeout(
        () =>
          resolve({
            data: MockPresets
          }),
        300
      );
    });
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
    builder
      .addCase(fetchPreset.pending, (state: GesturesState) => {
        state.pending = true;
        state.error = false;
      })
      .addCase(
        fetchPreset.fulfilled,
        (state: GesturesState, action: PayloadAction<IPreset[]>) => {
          state.pending = false;
          state.value = action.payload;
          state.activePresetIndex = 0;
          if (action.payload[0]) {
            state.activePreset = action.payload[0];
          }
        }
      )
      .addCase(fetchPreset.rejected, (state: GesturesState) => {
        state.value = [];
        state.activePreset = null;
        state.pending = false;
        state.error = true;
      });
  }
});

export const { setActivePreset, nextPreset, prevPreset, setPresets } =
  presetSlice.actions;
export default presetSlice.reducer;
