import { ISettingsData } from './../../../../types/index';
import { createSlice, PayloadAction, Draft } from '@reduxjs/toolkit';

const initialState: ISettingsData = {
  isSoundEnable: false
};

const statsSlice = createSlice({
  name: 'stats',
  initialState: initialState,
  reducers: {
    setIsSoundEnable: (
      state: Draft<typeof initialState>,
      action: PayloadAction<ISettingsData>
    ) => {
      state = action.payload;
      return state;
    }
  }
});

export const { setIsSoundEnable } = statsSlice.actions;

export default statsSlice.reducer;
