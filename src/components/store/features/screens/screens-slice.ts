import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// The 'splash' screen is injected in App.tsx instead to reduce loading times
export type ScreenType =
  | 'ready'
  | 'barometer'
  | 'pressets'
  | 'pressetSettings'
  | 'name'
  | 'pressure'
  | 'time'
  | 'weight'
  | 'flow'
  | 'temperature'
  | 'dose'
  | 'output'
  | 'scale'
  | 'settings'
  | 'timeDate'
  | 'timeZoneConfig'
  | 'notifications'
  | 'wifiSettings'
  | 'wifiQrMenu'
  | 'wifiDetails'
  | 'connectWifiMenu'
  | 'selectWifi'
  | 'connectWifiViaApp'
  | 'OSStatus'
  | 'enterWifiPassword'
  | 'quick-settings'
  | 'brewSettings'
  | 'snake'
  | 'KnownWifi'
  | 'deleteKnowWifiMenu'
  | 'advancedSettings'
  | 'pressetProfileImage'
  | 'deviceInfo'
  | 'updateChannel'
  | 'idleScreenSettings'
  | 'defaultProfiles'
  | 'defaultProfileDetails'
  | 'manual-purge'
  | 'heating'
  | 'heat_timeout_after_shot'
  | 'idle'
  | 'selectLetterCountry'
  | 'countrySettings'
  | 'timeZoneSettings'
  | 'timeConfig'
  | 'dateConfig'
  | 'calibrateScale'
  | 'usbSettings'
  | 'shot_history'
  | 'scrollDirections'
  | 'preheatScreen';

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
  value: 'ready'
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
