import { Draft, createSlice } from '@reduxjs/toolkit';

interface ISettingBase {
  label: string;
}

export type HomeKey = 'home';

export type PurgeKey = 'purge';

export type CalibrateKey = 'calibrate';

export type ExitKey = 'exit';

interface ISettingHome extends ISettingBase {
  key: HomeKey;
}

interface ISettingPurge extends ISettingBase {
  key: PurgeKey;
}

interface ISettingCalibrate extends ISettingBase {
  key: CalibrateKey;
}

interface ISettingExit extends ISettingBase {
  key: ExitKey;
}

export type ISetting =
  | ISettingHome
  | ISettingPurge
  | ISettingCalibrate
  | ISettingExit;

export interface SettingsInterface {
  activeIndexSetting: number;
  settings: ISetting[];
}

const initialState: SettingsInterface = {
  activeIndexSetting: 0,
  settings: [
    {
      key: 'home',
      label: 'home'
    },
    {
      key: 'purge',
      label: 'purge'
    },
    {
      key: 'calibrate',
      label: 'calibrate scale'
    },
    {
      key: 'exit',
      label: 'exit'
    }
  ]
};

const settingSlice = createSlice({
  name: 'settings',
  initialState: initialState,
  reducers: {
    setNextSettingOption: (state: Draft<typeof initialState>) => {
      const nextActiveIndex = state.activeIndexSetting + 1;

      if (nextActiveIndex <= state.settings.length - 1) {
        state.activeIndexSetting = nextActiveIndex;
      }

      return state;
    },
    setPrevSettingOption: (state: Draft<typeof initialState>) => {
      state.activeIndexSetting = Math.max(state.activeIndexSetting - 1, 0);
    }
  }
});

export const { setNextSettingOption, setPrevSettingOption } =
  settingSlice.actions;

export default settingSlice.reducer;
