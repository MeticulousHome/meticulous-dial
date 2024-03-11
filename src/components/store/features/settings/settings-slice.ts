import { createSlice } from '@reduxjs/toolkit';

const initialState = {};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSettings: (state, action) => {
      // This is to store any new setting from backend
      return action.payload;
    }
  }
});

export const { updateSettings } = settingsSlice.actions;
export default settingsSlice.reducer;
