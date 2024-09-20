import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../../../api/api';

import {
  Settings,
  SettingsType,
  DeviceInfo
} from '@meticulous-home/espresso-api';

type InitialSettings = Settings & { deviceInfo?: DeviceInfo };

export const initialState: InitialSettings = {
  disallow_firmware_flashing: false,
  auto_purge_after_shot: false,
  auto_start_shot: false,
  auto_preheat: 0,
  enable_sounds: false,
  save_debug_shot_data: false,
  update_channel: 'stable',
  deviceInfo: null
};

export const fetchSettigns = createAsyncThunk(
  'settings/fetchSettings',
  async () => {
    try {
      const { data } = await api.getSettings();
      return data;
    } catch (error) {
      throw new Error(error);
    }
  }
);

export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async (body: Partial<InitialSettings>, { rejectWithValue }) => {
    try {
      const payload = { ...body };
      if (payload.deviceInfo) payload.deviceInfo = undefined;

      const { data } = await api.updateSetting(payload);

      if (!data) rejectWithValue('Error updating settings');

      return data;
    } catch (error) {
      throw new Error(error);
    }
  }
);

export const getDeviceInfo = createAsyncThunk(
  'settings/getDeviceInfo',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.getDeviceInfo();

      if (!data) rejectWithValue('Error getting device info');

      return data;
    } catch (error) {
      throw new Error(error);
    }
  }
);

interface UpdateItemSettingAction {
  payload: {
    key: keyof Settings;
    value: SettingsType;
  };
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateItemSetting: (
      state: Partial<Settings>,
      action: UpdateItemSettingAction
    ) => {
      const key: keyof Settings = action.payload.key;
      const value: SettingsType = action.payload.value;
      (state[key] as SettingsType) = value;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettigns.fulfilled, (state, action) => {
        return {
          ...state,
          ...action.payload
        };
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        return {
          ...state,
          ...action.payload
        };
      })
      .addCase(updateSettings.rejected, (state) => {
        return { ...initialState, deviceInfo: state.deviceInfo };
      })
      .addCase(getDeviceInfo.fulfilled, (state, action) => {
        return {
          ...state,
          deviceInfo: action.payload as DeviceInfo
        };
      })
      .addCase(getDeviceInfo.rejected, (state) => {
        return { ...state, deviceInfo: null };
      });
  }
});

export const { updateItemSetting } = settingsSlice.actions;
export default settingsSlice.reducer;
