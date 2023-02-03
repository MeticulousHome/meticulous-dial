import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ScreenType = 'barometer' | 'pressets' | 'pressetSettings';

interface ScreenState {
  value: ScreenType;
  prev: ScreenType;
}

const initialState: ScreenState = {
  value: 'barometer',
  prev: null
};

const screenSlice = createSlice({
  name: 'screen',
  initialState,
  reducers: {
    setScreen: (state: ScreenState, action: PayloadAction<ScreenType>) => {
      state.prev = state.value;
      state.value = action.payload;
    }
  }
});

export const { setScreen } = screenSlice.actions;
export default screenSlice.reducer;
