import { AxiosResponse } from 'axios';
import {
  NetworkConfig,
  PasswortConnect,
  Wifi,
  WifiStatus
} from './../../../../types';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface WifiState {
  // TODO: update type when integrated with backend
  selectedWifi: string;
  pending: boolean;
  connectionResult: string;
  error: boolean;
  networkConfig: NetworkConfig;
  wifiStatus: WifiStatus;
  wifiList: Wifi[];
  knownWifis: string[];
}

const initialState: WifiState = {
  selectedWifi: null,
  pending: false,
  connectionResult: null,
  error: false,
  networkConfig: null,
  wifiStatus: null,
  wifiList: [],
  knownWifis: []
};

export const getConfig = createAsyncThunk('wifi/getConfig', async () => {
  const networkConfig = await window.meticulousAPI.getNetworkConfig();
  return networkConfig;
});

export const getWifis = createAsyncThunk('wifi/list', async () => {
  const wifiList = await window.meticulousAPI.getWifiList();
  return wifiList;
});

export const saveConfig = createAsyncThunk(
  'wifi/updateConfig',
  async (newConfig: Partial<NetworkConfig>) => {
    const networkConfig = await window.meticulousAPI.updateNetworkConfig(
      newConfig
    );
    return networkConfig;
  }
);

export const connectToWifiThunk = createAsyncThunk(
  'wifi/connect',
  async (config: PasswortConnect) => {
    const response = await window.meticulousAPI.connectToWifi({
      ssid: config.ssid,
      password: config.password
    });

    return response;
  }
);

const wifiSlice = createSlice({
  name: 'wifi',
  initialState,
  reducers: {
    selectWifi: (state: WifiState, action: PayloadAction<string>) => {
      state.selectedWifi = action.payload;
    },
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
        if (action.payload) {
          const { config, status, known_wifis } = action.payload;
          state.networkConfig = config;
          state.wifiStatus = status;
          state.knownWifis = Object.keys(known_wifis).map(
            (key) => known_wifis[key]
          );
        }
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
      })
      .addCase(connectToWifiThunk.pending, (state) => {
        state.pending = true;
        console.log('Connect to wifi pending set');
      })
      .addCase(connectToWifiThunk.rejected, (state, action) => {
        state.pending = false;
        state.error = true;
        state.connectionResult = 'Connection error';
        console.log('connectToWifiThunk.rejected', action);
      })
      .addCase(connectToWifiThunk.fulfilled, (state, action) => {
        state.pending = false;
        const status = action.payload;
        console.log(status, action);
        if (!status || !status.status) {
          state.connectionResult = 'No response from machine backend';
          state.error = true;
        } else if (status.status === 'ok') {
          state.error = false;
          state.connectionResult = 'Successfully connected';
        } else {
          state.connectionResult = status.error || 'An unknown error occured';
          state.error = true;
        }
      });
    // .addCase(updateConfig.rejected, (state, action) => {
    //   console.log('save error', action);
    // });
  }
});

export const { selectWifi, updateConfig } = wifiSlice.actions;
export default wifiSlice.reducer;
