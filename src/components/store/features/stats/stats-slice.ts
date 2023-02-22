import { ISensorData } from './../../../../types/index';
import { createSlice, PayloadAction, Draft } from '@reduxjs/toolkit';

const initialState: ISensorData = {
  name: 'idle',
  sensors: {
    p: '0',
    f: '0',
    w: '0',
    t: '0'
  },
  time: '0',
  profile: 'Filter 2.1'
};

const statsSlice = createSlice({
  name: 'stats',
  initialState: initialState,
  reducers: {
    setStats: (
      state: Draft<typeof initialState>,
      action: PayloadAction<ISensorData>
    ) => {
      state = action.payload;
      return state;
    }
  }
});

export const { setStats } = statsSlice.actions;

export default statsSlice.reducer;
