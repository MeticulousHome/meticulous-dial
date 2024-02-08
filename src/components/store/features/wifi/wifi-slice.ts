import { NetworkConfig, Wifi, WifiStatus } from './../../../../types';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface WifiState {
  // TODO: update type when integrated with backend
  selectedWifi: string;
  pending: boolean;
  error: boolean;
  networkConfig: NetworkConfig;
  wifiStatus: WifiStatus;
  wifiList: Wifi[];
}

const initialState: WifiState = {
  selectedWifi: null,
  pending: false,
  error: false,
  networkConfig: null,
  wifiStatus: null,
  wifiList: []
};

export const getConfig = createAsyncThunk('wifi/getConfig', async () => {
  const networkConfig = await window.meticulousAPI.getNetworkConfig();
  return networkConfig;
});

export const getWifis = createAsyncThunk('wifi/list', async () => {
  const wifiList = await window.meticulousAPI.getWifiList();
  return wifiList;
});

// TODO: re-enable when API finish
// export const updateConfig = createAsyncThunk(
//   'wifi/updateConfig',
//   async (newConfig: Partial<NetworkConfig>) => {
//     const networkConfig = await window.meticulousAPI.updateNetworkConfig(
//       newConfig
//     );
//     return networkConfig;
//   }
// );

const wifiSlice = createSlice({
  name: 'wifi',
  initialState,
  reducers: {
    selectWifi: (state: WifiState, action: PayloadAction<string>) => {
      state.selectedWifi = action.payload;
    },
    // TODO: replace this with thunk above
    updateConfig: (state: WifiState, action: PayloadAction<NetworkConfig>) => {
      state.networkConfig = {
        ...state.networkConfig,
        ...action.payload
      };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getConfig.pending, (state) => {
        state.pending = true;
      })
      .addCase(getConfig.rejected, (state) => {
        state.pending = false;
        state.error = true;
      })
      .addCase(getConfig.fulfilled, (state, action) => {
        state.pending = false;
        const { config, status } = action.payload;
        state.networkConfig = config;
        state.wifiStatus = status;
      })
      .addCase(getWifis.pending, (state) => {
        state.pending = true;
      })
      .addCase(getWifis.rejected, (state) => {
        state.pending = false;
        state.error = true;
      })
      .addCase(getWifis.fulfilled, (state, action) => {
        state.pending = false;
        const list = action.payload;
        state.wifiList = list;
      });
    // .addCase(updateConfig.rejected, (state, action) => {
    //   console.log('save error', action);
    // });
  }
});

export const { selectWifi, updateConfig } = wifiSlice.actions;
export default wifiSlice.reducer;
