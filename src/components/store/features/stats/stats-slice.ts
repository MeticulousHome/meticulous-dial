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
  waterStatus: false,
  actuators: { m_pos: 0 }
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
        waitingForActionAlreadySent: state.waitingForActionAlreadySent,
        actuators: state.actuators
      };
      return state;
    },
    setPistonPosition: (
      state: Draft<typeof initialState>,
      action: PayloadAction<number>
    ) => {
      state.actuators = { ...state.actuators, m_pos: action.payload };
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

export const {
  setStats,
  setWaterStatus,
  setWaitingForAction,
  setPistonPosition
} = statsSlice.actions;

export default statsSlice.reducer;
