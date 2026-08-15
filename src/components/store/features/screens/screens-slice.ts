import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// The 'splash' screen is injected in App.tsx instead to reduce loading times
export type ScreenType =
  | 'ready'
  | 'barometer'
  | 'profileHome'
  | 'pressetSettings'
  | 'name'
  | 'pressure'
  | 'time'
  | 'weight'
  | 'flow'
  | 'temperature'
  | 'piston_position'
  | 'motor_power'
  | 'dose'
  | 'output'
  | 'settings'
  | 'community'
  | 'timeDate'
  | 'timeZoneConfig'
  | 'notifications'
  | 'wifiSettings'
  | 'wifiModeSettings'
  | 'wifiQrMenu'
  | 'wifiDetails'
  | 'connectWifiMenu'
  | 'selectWifi'
  | 'connectWifiViaApp'
  | 'bug-report'
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
  | 'shot_history'
  | 'scrollDirections'
  | 'brewComplete'
  | 'factoryReset'
  | 'retraction_volume'
  | 'tare_behavior'
  | 'manufacturingSettings'
  | 'displayAlignment'
  | 'masterCalibrationLock'
  | 'deviceInfoQR'
  | 'unlock';

interface ScreenState {
  value: ScreenType;
  prev?: ScreenType;
  bubbleDisplay: {
    interceptsGesture: boolean;
    visible: boolean;
    component?: ScreenType;
    previousComponent?: ScreenType;
  };
}

const initialState: ScreenState = {
  prev: undefined,
  bubbleDisplay: {
    interceptsGesture: false,
    visible: false,
    component: undefined,
    previousComponent: undefined
  },
  value: 'ready'
};

const screenSlice = createSlice({
  name: 'screen',
  initialState,
  reducers: {
    setScreen: (state: ScreenState, action: PayloadAction<ScreenType>) => {
      if (!action.payload) {
        console.error('Setting screen to undefined! Aborting', action.payload);
        return;
      }
      state.prev = state.value;
      state.value = action.payload;
    },
    setBubbleDisplay: (
      state: ScreenState,
      action: PayloadAction<{
        visible: boolean;
        component?: ScreenType;
        interceptsGesture?: boolean;
      }>
    ) => {
      state.bubbleDisplay.visible = action.payload.visible;
      state.bubbleDisplay.previousComponent = state.bubbleDisplay.component;
      state.bubbleDisplay.component = action.payload.component;
      state.bubbleDisplay.interceptsGesture =
        action.payload.interceptsGesture || action.payload.visible;
    }
  }
});

export const { setScreen, setBubbleDisplay } = screenSlice.actions;
export default screenSlice.reducer;
