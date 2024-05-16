import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
  | 'notifications'
  | 'wifiSettings'
  | 'wifiDetails'
  | 'connectWifi'
  | 'connectWifiMenu'
  | 'selectWifi'
  | 'connectWifiViaApp'
  | 'enterWifiPassword'
  | 'quick-settings'
  | 'quick-preheat'
  | 'snake'
  | 'KnownWifi'
  | 'deleteKnowWifiMenu'
  | 'deletedWifi'
  | 'wifiSettingsSave';

interface ScreenState {
  value: ScreenType;
  prev: ScreenType;
  bubbleDisplay: {
    visible: boolean;
    component: ScreenType | null;
    previousComponent: ScreenType | null;
  };
}

const initialState: ScreenState = {
  prev: null,
  bubbleDisplay: { visible: false, component: null, previousComponent: null },
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
      action: PayloadAction<{ visible: boolean; component: ScreenType }>
    ) => {
      state.bubbleDisplay.visible = action.payload.visible;
      state.bubbleDisplay.previousComponent = state.bubbleDisplay.component;
      state.bubbleDisplay.component = action.payload.component;
    }
  }
});

export const { setScreen, setBubbleDisplay } = screenSlice.actions;
export default screenSlice.reducer;
