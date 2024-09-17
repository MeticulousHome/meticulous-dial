import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface WifiState {
  selectedWifi: string;
  selectedWifiToDelete: string;
}

const initialState: WifiState = {
  selectedWifi: null,
  selectedWifiToDelete: null
};

const wifiSlice = createSlice({
  name: 'wifi',
  initialState,
  reducers: {
    selectWifi: (state: WifiState, action: PayloadAction<string>) => {
      state.selectedWifi = action.payload;
    },
    selectWifiToDelete: (state: WifiState, action: PayloadAction<string>) => {
      state.selectedWifiToDelete = action.payload;
    }
  }
});

export const { selectWifi, selectWifiToDelete } = wifiSlice.actions;
export default wifiSlice.reducer;
