import { ISensorDataAndMachineState } from './../../../../types/index';
import { createSlice, PayloadAction, Draft } from '@reduxjs/toolkit';

const initialState: ISensorDataAndMachineState = {
  id: '',
  state: 'idle',
  name: 'idle',
  extracting: false,
  sensors: {
    p: 0,
    f: 0,
    w: 0,
    t: 0,
    g: 0
  },
  time: 0,
  profile: undefined,
  setpoints: {},
  loaded_profile: '',

  waterStatus: true,
  waitingForActionAlreadySent: false,
  preheatTimeLeft: 0
};

const statsSlice = createSlice({
  name: 'stats',
  initialState: initialState,
  reducers: {
    setStats: (
      state: Draft<typeof initialState>,
      action: PayloadAction<ISensorDataAndMachineState>
    ) => {
      state = {
        ...action.payload,
        waterStatus: state.waterStatus,
        waitingForActionAlreadySent: state.waitingForActionAlreadySent,
        preheatTimeLeft: state.preheatTimeLeft
      };
      return state;
    },
    updatePreheatTimeLeft: (
      state: Draft<typeof initialState>,
      action: PayloadAction<number>
    ) => {
      state.preheatTimeLeft = action.payload;
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

export const {
  setStats,
  setWaterStatus,
  setWaitingForAction,
  updatePreheatTimeLeft
} = statsSlice.actions;

export default statsSlice.reducer;
