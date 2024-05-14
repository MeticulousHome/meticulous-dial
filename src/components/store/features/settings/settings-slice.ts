import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { isAxiosError } from 'axios';

import Api, { SettingsType, Settings } from 'meticulous-api';

const api = new Api();

export const initialState: Settings = {
  disallow_firmware_flashing: false,
  auto_purge_after_shot: false,
  auto_start_shot: false,
  auto_preheat: 0,
  enable_sounds: false,
  save_debug_shot_data: false
};

export const fetchSettigns = createAsyncThunk(
  'settings/fetchSettings',
  async () => {
    try {
      const { data } = await api.getSettings();
      return data;
    } catch (error) {
      if (isAxiosError(error)) return error.message;
      return error;
    }
  }
);

export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async (body: Partial<Settings>) => {
    try {
      const { data } = await api.updateSetting(body);
      return data;
    } catch (error) {
      if (isAxiosError(error)) return error.message;
      return error;
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
      console.log(state);
      const key: keyof Settings = action.payload.key;
      const value: SettingsType = action.payload.value;
      (state[key] as SettingsType) = value;
      console.log(state);
    }
  },
  extraReducers(builder) {
    builder
      .addCase(fetchSettigns.fulfilled, (state, action) => {
        return action.payload;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        return action.payload;
      });
  }
});

export const { updateItemSetting } = settingsSlice.actions;
export default settingsSlice.reducer;
