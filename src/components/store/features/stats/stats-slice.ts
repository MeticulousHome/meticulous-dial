import {
  ISensorDataAndMachineState,
  ISensorData
} from './../../../../types/index';
import { createSlice, PayloadAction, Draft } from '@reduxjs/toolkit';

const initialState: ISensorDataAndMachineState & { sensorData: ISensorData } = {
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
  profile_time: 0,
  profile: undefined,
  setpoints: {},
  loaded_profile: '',
  sensorData: {
    t_ext_1: 0,
    t_ext_2: 0,
    t_bar_up: 0,
    t_bar_mu: 0,
    t_bar_md: 0,
    t_bar_down: 0,
    t_tube: 0,
    t_motor_temp: 0,
    lam_temp: 0,
    p: 0,
    a_0: 0,
    a_1: 0,
    a_2: 0,
    a_3: 0,
    m_pos: 0,
    m_spd: 0,
    m_pwr: 0,
    m_cur: 0,
    bh_pwr: 0,
    bh_cur: 0,
    w_stat: 0,
    motor_temp: 0,
    weight_pred: 0
  },
  waterStatus: true,
  waitingForActionAlreadySent: false,
  preheatTimeLeft: 0
};

const statsSlice = createSlice({
  name: 'stats',
  initialState: initialState,
  reducers: {
    setSensors: (
      state: Draft<typeof initialState>,
      action: PayloadAction<ISensorData>
    ) => {
      state = { ...state, sensorData: action.payload };
      return state;
    },
    setStats: (
      state: Draft<typeof initialState>,
      action: PayloadAction<ISensorDataAndMachineState>
    ) => {
      state = {
        ...action.payload,
        waterStatus: state.waterStatus,
        waitingForActionAlreadySent: state.waitingForActionAlreadySent,
        sensorData: state.sensorData,
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
  setSensors,
  setWaterStatus,
  setWaitingForAction,
  updatePreheatTimeLeft
} = statsSlice.actions;

export default statsSlice.reducer;
