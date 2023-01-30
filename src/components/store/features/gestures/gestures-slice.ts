import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { GestureType } from '../../../../types/index';

interface GesturesState {
  value: GestureType;
  key: number;
}

const initialState: GesturesState = {
  value: '',
  key: 0
};

const gestureSlice = createSlice({
  name: 'gesture',
  initialState,
  reducers: {
    setGesture: (state: GesturesState, action: PayloadAction<GestureType>) => {
      state.value = action.payload;
      state.key = new Date().getMilliseconds();
    }
  }
});

export const { setGesture } = gestureSlice.actions;
export default gestureSlice.reducer;
