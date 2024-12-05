import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../../../api/api';

import {
  Settings,
  SettingsType,
  DeviceInfo
} from '@meticulous-home/espresso-api';

type InitialSettings = Partial<Settings> & {
  deviceInfo?: DeviceInfo;
  PreheatTimeLeft: number;
  heating_timeout: number;
  tempHeatingTimeout: number | null;
  countryLetter: string | null;
  country: string | null;
};

export const initialState: InitialSettings = {
  auto_purge_after_shot: false,
  auto_start_shot: false,
  enable_sounds: false,
  save_debug_shot_data: false,
  update_channel: 'stable',
  deviceInfo: null,
  PreheatTimeLeft: 0,
  heating_timeout: 0,
  tempHeatingTimeout: null,
  countryLetter: null,
  country: null
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
    },
    updatePreheatTimeLeft: (state, action: PayloadAction<number>) => {
      state.PreheatTimeLeft = action.payload;
    },
    updateHeatingTimeout: (state, action: PayloadAction<number>) => {
      state.heating_timeout = action.payload;
    },
    setTempHeatingTimeout: (state, action: PayloadAction<number | null>) => {
      state.tempHeatingTimeout = action.payload;
    },
    setCountryLetter: (state, action: PayloadAction<string>) => {
      state.countryLetter = action.payload;
    },
    setCountry: (state, action: PayloadAction<string>) => {
      state.country = action.payload;
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
          ...action.payload,
          tempHeatingTimeout: null // Clear temporary value after successful update
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

export const {
  updateItemSetting,
  updatePreheatTimeLeft,
  setTempHeatingTimeout,
  setCountryLetter,
  setCountry
} = settingsSlice.actions;
export default settingsSlice.reducer;
