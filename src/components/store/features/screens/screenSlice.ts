import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ScreenName } from './../../../../types/screens';

interface ScreensState {
  screenName: ScreenName;
}

const initialState: ScreensState = {
  screenName: ScreenName.INFO
};

const screenSlice = createSlice({
  name: 'screen',
  initialState,
  reducers: {
    setScreen: (state: ScreensState, action: PayloadAction<ScreenName>) => {
      console.log('Log ~ file: screenSlice.ts:20 ~ action', action);
      state.screenName = action.payload;
    }
  }
});

export const { setScreen } = screenSlice.actions;
export default screenSlice.reducer;
