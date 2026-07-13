import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface WifiState {
  selectedWifi?: string;
  selectedWifiUseKnownCredentials?: boolean;
  selectedWifiToDelete?: string;
}

const initialState: WifiState = {
  selectedWifi: undefined,
  selectedWifiUseKnownCredentials: false,
  selectedWifiToDelete: undefined
};

type SelectWifiPayload =
  | string
  | {
      ssid: string;
      useKnownCredentials?: boolean;
    };

const wifiSlice = createSlice({
  name: 'wifi',
  initialState,
  reducers: {
    selectWifi: (
      state: WifiState,
      action: PayloadAction<SelectWifiPayload>
    ) => {
      if (typeof action.payload === 'string') {
        state.selectedWifi = action.payload;
        state.selectedWifiUseKnownCredentials = false;
        return;
      }

      state.selectedWifi = action.payload.ssid;
      state.selectedWifiUseKnownCredentials = Boolean(
        action.payload.useKnownCredentials
      );
    },
    selectWifiToDelete: (state: WifiState, action: PayloadAction<string>) => {
      state.selectedWifiToDelete = action.payload;
    }
  }
});

export const { selectWifi, selectWifiToDelete } = wifiSlice.actions;
export default wifiSlice.reducer;
