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
  profile: undefined,
  setpoints: {},
  waterStatus: true
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
        waterStatus: state.waterStatus,
        waitingForActionAlreadySent: state.waitingForActionAlreadySent
      };
      return state;
    },
    setWaterStatus: (
      state: Draft<typeof initialState>,
      action: PayloadAction<boolean>
    ) => {
      state.waterStatus = action.payload;
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

export const { setStats, setWaterStatus, setWaitingForAction } =
  statsSlice.actions;

export default statsSlice.reducer;
