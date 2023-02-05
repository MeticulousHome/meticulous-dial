import { createSlice, PayloadAction, Draft } from '@reduxjs/toolkit';
import { StageType } from '../../../../types';

export interface SensorDataInterface {
  name: StageType;
  sensors: {
    p: string; // Bars
    f: string; // ml/s
    w: string; // grams
    t: string; // degrees celcius
  };
  time: string; // seconds
}
const initialState: SensorDataInterface = {
  name: 'idle',
  sensors: {
    p: '0',
    f: '0',
    w: '0',
    t: '0'
  },
  time: '0'
};

const statsSlice = createSlice({
  name: 'stats',
  initialState: initialState,
  reducers: {
    setStats: (
      state: Draft<typeof initialState>,
      action: PayloadAction<SensorDataInterface>
    ) => {
      state = action.payload;
      return state;
    }
  }
});

export const { setStats } = statsSlice.actions;

export default statsSlice.reducer;
