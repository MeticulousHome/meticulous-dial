import { ISensorData } from './../../../../types/index';
import { createSlice, PayloadAction, Draft } from '@reduxjs/toolkit';
import { StageType } from '../../../../types';

const initialState: ISensorData = {
  name: 'idle',
  sensors: {
    p: '0',
    f: '0',
    w: '200',
    t: '53.8'
  },
  time: '0'
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
