import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { isAxiosError } from 'axios';

import SettingsApi from '../../../../api/settings';

const initialState = {};

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
  reducers: {},
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

export default settingsSlice.reducer;
