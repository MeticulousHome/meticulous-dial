import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ComponentType } from 'react';

export type ScreenType =
  | 'barometer'
  | 'pressets'
  | 'pressetSettings'
  | 'name'
  | 'pressure'
  | 'temperature'
  | 'dose'
  | 'ratio'
  | 'output'
  | 'pre-infusion'
  | 'pre-heat'
  | 'scale'
  | 'settings'
  | 'purge'
  | 'notifications';

interface ScreenState {
  value: ScreenType;
  prev: ScreenType;
  bubbleDisplay: { visible: boolean; component: ComponentType | null };
}

const initialState: ScreenState = {
  prev: null,
  bubbleDisplay: { visible: false, component: null },
  value: 'pressets'
};

const screenSlice = createSlice({
  name: 'screen',
  initialState,
  reducers: {
    setScreen: (state: ScreenState, action: PayloadAction<ScreenType>) => {
      state.prev = state.value;
      state.value = action.payload;
    },
    setBubbleDisplay: (
      state: ScreenState,
      action: PayloadAction<{ visible: boolean; component: ComponentType }>
    ) => {
      state.bubbleDisplay.visible = action.payload.visible;
      state.bubbleDisplay.component = action.payload.component;
    }
  }
});

export const { setScreen, setBubbleDisplay } = screenSlice.actions;
export default screenSlice.reducer;
