import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type ScreenType = 'barometer' | 'pressets' | 'pressetSettings';

interface ScreenState {
  value: ScreenType;
}

const initialState: ScreenState = {
  value: 'barometer'
};

const screenSlice = createSlice({
  name: 'screen',
  initialState,
  reducers: {
    setScreen: (state: ScreenState, action: PayloadAction<ScreenType>) => {
      state.value = action.payload;
    }
  }
});

export const { setScreen } = screenSlice.actions;
export default screenSlice.reducer;
