import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { isAxiosError } from 'axios';

import SettingsApi from '../../../../api/settings';

export type UserSettingsKeys =
  | 'sounds_enabled'
  | 'disallow_firmware_flashing'
  | 'debug_shot_data'
  | 'auto_purge_after_shot'
  | 'auto_start_shot';

const initialState: Partial<Record<UserSettingsKeys, any>> = {
  sounds_enabled: false,
  disallow_firmware_flashing: false,
  debug_shot_data: false,
  auto_purge_after_shot: false,
  auto_start_shot: false
};

export const fetchSettigns = createAsyncThunk(
  'settings/fetchSettings',
  async () => {
    try {
      const { data } = await SettingsApi.get();
      return data;
    } catch (error) {
      if (isAxiosError(error)) return error.message;
      return error;
    }
  }
);

export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async (body: Record<string, any>) => {
    try {
      const { data } = await SettingsApi.update(body);
      return data;
    } catch (error) {
      if (isAxiosError(error)) return error.message;
      return error;
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateItemSetting: (state: typeof initialState, action) => {
      state[action.payload.key as UserSettingsKeys] = action.payload.value;
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
