import { ISensorData } from './../../../../types/index';
import { createSlice, PayloadAction, Draft } from '@reduxjs/toolkit';

const initialState: ISensorData = {
  name: 'idle',
  waitingForActionAlreadySent: false,
  sensors: {
    p: '0',
    f: '0',
    w: '0',
    t: '0'
  },
  time: '0',
  profile: undefined
};

const statsSlice = createSlice({
  name: 'stats',
  initialState: initialState,
  reducers: {
    setStats: (
      state: Draft<typeof initialState>,
      action: PayloadAction<ISensorData>
    ) => {
      state = {
        ...action.payload,
        waitingForActionAlreadySent: state.waitingForActionAlreadySent
      };
      return state;
    },
    setWaitingForAction: (
      state: Draft<typeof initialState>,
      action: PayloadAction<boolean>
    ) => {
      state.waitingForActionAlreadySent = action.payload;
      return state;
    }
  }
});

export const { setStats, setWaitingForAction } = statsSlice.actions;

export default statsSlice.reducer;
