import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PairingState {
  selectedDeviceId?: string;
  selectedDeviceName?: string;
}

const initialState: PairingState = {
  selectedDeviceId: undefined,
  selectedDeviceName: undefined
};

const pairingSlice = createSlice({
  name: 'pairing',
  initialState,
  reducers: {
    selectPairedDevice: (
      state: PairingState,
      action: PayloadAction<{ deviceId: string; deviceName: string }>
    ) => {
      state.selectedDeviceId = action.payload.deviceId;
      state.selectedDeviceName = action.payload.deviceName;
    }
  }
});

export const { selectPairedDevice } = pairingSlice.actions;
export default pairingSlice.reducer;
