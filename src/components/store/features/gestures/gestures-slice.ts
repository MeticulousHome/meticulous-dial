import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { GestureType } from '../../../../types/index';

interface GesturesState {
  value: GestureType;
  prev: GestureType;
}

const initialState: GesturesState = {
  value: '',
  prev: ''
};

const gestureSlice = createSlice({
  name: 'gesture',
  initialState,
  reducers: {
    setGesture: (state: GesturesState, action: PayloadAction<GestureType>) => {
      state.prev = state.value;
      state.value = action.payload;
    }
  }
});

export const { setGesture } = gestureSlice.actions;
export default gestureSlice.reducer;
