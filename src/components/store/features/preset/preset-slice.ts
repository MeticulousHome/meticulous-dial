import {
  createAsyncThunk,
  createSlice,
  Draft,
  PayloadAction
} from '@reduxjs/toolkit';
import { settingsDefaultNewPreset } from '../../../../utils/mock';

import {
  IPreset,
  IPresetSetting,
  IPresetsSettingData
} from '../../../../types/index';
import { RootState } from '../../store';
import { getSettingsFromDashboardPayload } from '../../../../utils/preheat';
import { DEFAULT_SETTING } from '../../../../constants/setting';
import { getPresetsData, setPresetsData } from '../../../../data/presets';

export interface PresetSettingInterface {
  activeSetting: number;
  startIndex: number;
  pending: boolean;
  error: boolean;
  updatingSettings: IPresetsSettingData;
  allSettings: IPresetsSettingData[];
}

interface PresetsState extends PresetSettingInterface {
  value: IPreset[];
  defaultPresetIndex: number;
  activeIndexSwiper: number;
  activePreset: IPreset;
  pending: boolean;
  error: boolean;
}

export const addPresetFromDashboard = createAsyncThunk(
  'presetData/addPresetFromDashboard',
  async (payload: any, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;

    const presetList = presetState.value.map((preset) => ({
      ...preset,
      isDefault: false
    }));

    const presetId = new Date().getTime();

    presetList.push({
      id: presetId,
      name: payload.name,
      isDefault: true
    });

    presetState.value = presetList;
    presetState.activeIndexSwiper = presetState.value.length - 1;
    presetState.activePreset = presetState.value[presetState.activeIndexSwiper];

    await setPresetsData(presetList);

    const settings = getSettingsFromDashboardPayload(payload);

    const allSettings: IPresetsSettingData[] = [
      ...state.presets.allSettings,
      {
        presetId: presetId.toString(),
        settings
      }
    ];

    return presetState;
  }
);

export const addPresetNewOne = createAsyncThunk(
  'presetData/addNewOne',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;

    const presetList = presetState.value.map((preset) => ({
      ...preset,
      isDefault: false
    }));

    const presetId = new Date().getTime();

    presetList.push({
      id: presetId,
      name: 'New Preset',
      isDefault: true,
      settings: settingsDefaultNewPreset
    });
    presetState.value = presetList;
    presetState.activeIndexSwiper = presetState.value.length - 1;
    presetState.activePreset = presetState.value[presetState.activeIndexSwiper];

    await setPresetsData(presetList);

    // const allSettings: IPresetsSettingData[] = [
    //   ...state.presets.allSettings,
    //   {
    //     presetId: presetId.toString(),
    //     settings: settingsDefaultNewPreset
    //   }
    // ];

    return presetState;
  }
);

export const setPrevPreset = createAsyncThunk(
  'presetData/setPrevPreset',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;
    const currentActiveIndex =
      presetState.activeIndexSwiper > -1
        ? presetState.activeIndexSwiper
        : presetState.defaultPresetIndex;
    if (presetState.activeIndexSwiper > 0) {
      presetState.activeIndexSwiper += -1;
    }
    if (presetState.activeIndexSwiper === presetState.value.length) return;
    if (currentActiveIndex > 0) {
      const newActivePresetIndex = currentActiveIndex - 1;
      const presetList = [...presetState.value].map((i) => {
        return {
          ...i,
          isDefault: false
        };
      });
      presetList[newActivePresetIndex] = {
        ...presetList[newActivePresetIndex],
        isDefault: true
      };
      presetState.activePreset = presetList[newActivePresetIndex];
      presetState.value = presetList;
      presetState.updatingSettings = {
        presetId: presetList[newActivePresetIndex].id.toString(),
        settings: presetList[newActivePresetIndex].settings
      };
      await setPresetsData(presetList);
      dispatch(
        setPresetState({
          ...presetState
        })
      );
    } else {
      // throw new Error('No more presets');
    }
  }
);

export const setNextPreset = createAsyncThunk(
  'presetData/setNextPreset',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;

    const currentActiveIndex =
      presetState.activeIndexSwiper > -1
        ? presetState.activeIndexSwiper
        : presetState.defaultPresetIndex;

    if (presetState.activeIndexSwiper < presetState.value.length) {
      presetState.activeIndexSwiper += 1;
    }

    if (currentActiveIndex === presetState.value.length) return;

    if (currentActiveIndex < presetState.value.length - 1) {
      const newActivePresetIndex = currentActiveIndex + 1;

      const presetList = [...presetState.value].map((i) => {
        return {
          ...i,
          isDefault: false
        };
      });

      presetList[newActivePresetIndex] = {
        ...presetList[newActivePresetIndex],
        isDefault: true
      };
      presetState.activePreset = presetList[newActivePresetIndex];
      presetState.updatingSettings = {
        presetId: presetList[newActivePresetIndex].id.toString(),
        settings: presetList[newActivePresetIndex].settings
      };
      presetState.value = presetList;

      await setPresetsData(presetList);
    }
    dispatch(
      setPresetState({
        ...presetState
      })
    );
  }
);
export const deletePreset = createAsyncThunk(
  'presetData/deletePreset',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;
    const presets = [...presetState.value];
    let newSwiperIndex = presetState.activeIndexSwiper;
    let newDefaultPreset = { ...presetState.activePreset };

    let newListPresets: IPreset[] = presets.filter(
      (preset) => preset.id !== presetState.activePreset.id
    );

    if (newListPresets.length < presets.length) {
      newDefaultPreset =
        newListPresets.length > 0
          ? newListPresets[0]
          : { id: -1, name: 'Default', isDefault: false };
      newSwiperIndex = 0;
      newListPresets = newListPresets.map((preset) => ({
        ...preset,
        isDefault: preset.id === newDefaultPreset.id
      }));
    }
    await setPresetsData(newListPresets);

    presetState.value = newListPresets;
    presetState.activeIndexSwiper = newSwiperIndex;
    presetState.activePreset = newDefaultPreset;

    dispatch(
      setPresetState({
        ...presetState
      })
    );
  }
);
export const setActiveIndexSwiper = createAsyncThunk(
  'presetData/setActiveIndexSwiper',
  async (payload: number, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;
    if (payload > 0 && payload <= presetState.value.length) {
      presetState.activeIndexSwiper = payload;
    }

    dispatch(
      setPresetState({
        ...presetState
      })
    );
  }
);

export const setNextSettingOption = createAsyncThunk(
  'presetData/setNextSettingOption',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;
    const nextActiveSetting = presetState.activeSetting + 1;
    const endIndex =
      presetState.activePreset.settings.filter(({ hidden }) => !hidden).length +
      DEFAULT_SETTING.length -
      1;

    if (nextActiveSetting > endIndex) {
      return;
    }
    presetState.activeSetting = nextActiveSetting;

    dispatch(
      setPresetState({
        ...presetState
      })
    );
  }
);

export const setPrevSettingOption = createAsyncThunk(
  'presetData/setPrevSettingOption',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;
    const nextActiveSetting = presetState.activeSetting - 1;
    if (nextActiveSetting < presetState.startIndex) {
      return;
    }
    presetState.activeSetting = nextActiveSetting;

    dispatch(
      setPresetState({
        ...presetState
      })
    );
  }
);

export const discardSettings = createAsyncThunk(
  'presetData/discardSettings',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;
    presetState.updatingSettings = {
      presetId: presetState.activePreset.id.toString(),
      settings: presetState.activePreset.settings || []
    };

    dispatch(
      setPresetState({
        ...presetState
      })
    );
  }
);

export const resetActiveSetting = createAsyncThunk(
  'presetData/resetActiveSetting',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;
    presetState.activeSetting = 0;

    dispatch(
      setPresetState({
        ...presetState
      })
    );
  }
);

export const savePreset = createAsyncThunk(
  'presetData/savePreset',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;
    const updateSetting = presetState.updatingSettings;
    const activePreset = {
      ...presetState.activePreset,
      settings: [...updateSetting.settings]
    };
    presetState.activePreset = { ...activePreset };

    const activeIndex = presetState.activeIndexSwiper;
    const copyListPresets = [...presetState.value];
    copyListPresets[activeIndex] = {
      ...copyListPresets[activeIndex],
      name: updateSetting.settings[0]?.value.toString(),
      settings: [...updateSetting.settings]
    };
    presetState.value = [...copyListPresets];
    console.log('run', presetState.value);
    await setPresetsData(presetState.value);

    dispatch(
      setPresetState({
        ...presetState
      })
    );
  }
);

export const getPresets = createAsyncThunk('presetData/getData', async () => {
  const presetsData = await getPresetsData();

  return JSON.parse(presetsData) as IPreset[];
});

const initialState: PresetsState = {
  value: [],
  defaultPresetIndex: -1,
  activeIndexSwiper: 0,
  activePreset: {
    name: '',
    id: -1
  },
  activeSetting: 0,
  startIndex: 0,

  updatingSettings: {
    presetId: '-1',
    settings: []
  },
  allSettings: [],
  pending: false,
  error: false
};

const presetSlice = createSlice({
  name: 'presets',
  initialState,
  reducers: {
    setActivePreset: (state: PresetsState, action: PayloadAction<number>) => {
      // state.activePresetIndex = action.payload;
    },
    setPresetState: (
      state: Draft<typeof initialState>,
      action: PayloadAction<PresetsState>
    ) => {
      return { ...action.payload };
    },

    // setting
    updatePresetSetting: (
      state: Draft<typeof initialState>,
      action: PayloadAction<IPresetSetting>
    ) => {
      state.updatingSettings.settings = state.updatingSettings.settings.map(
        (setting) =>
          setting.id === action.payload.id ? action.payload : setting
      );
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getPresets.pending, (state) => {
        state.pending = true;
      })
      .addCase(getPresets.fulfilled, (state, action) => {
        state.pending = false;
        state.value = action.payload;
        if (action.payload.length) {
          const defaultIndex = action.payload.findIndex(
            (preset) => preset.isDefault
          );
          if (defaultIndex !== -1) {
            state.defaultPresetIndex = defaultIndex;
            state.allSettings = action.payload.map((preset) => ({
              presetId: preset.id.toString(),
              settings: preset?.settings || []
            }));
            state.activePreset = action.payload[defaultIndex];
            state.updatingSettings = {
              presetId: action.payload[defaultIndex].id.toString(),
              settings: action.payload[defaultIndex]?.settings || []
            };
            state.activeIndexSwiper = defaultIndex;
            // state.activePresetIndex = defaultIndex;
          }
        } else {
          state.defaultPresetIndex = 0;
          state.activeIndexSwiper = 0;
        }
      })
      .addCase(getPresets.rejected, (state) => {
        state.pending = false;
        state.error = true;
      })
      .addCase(addPresetNewOne.pending, (state) => {
        state.pending = true;
      })
      .addCase(addPresetNewOne.rejected, (state, action) => {
        state.pending = false;
        state.error = true;
        console.log(action.error);
      })
      .addCase(
        addPresetNewOne.fulfilled,
        (state, action: PayloadAction<PresetsState>) => {
          state.value = action.payload.value;
          state.activeIndexSwiper = action.payload.activeIndexSwiper;
          state.activePreset = action.payload.activePreset;
        }
      )
      .addCase(addPresetFromDashboard.pending, (state) => {
        state.pending = true;
      })
      .addCase(addPresetFromDashboard.rejected, (state) => {
        state.pending = false;
        state.error = true;
      })
      .addCase(
        addPresetFromDashboard.fulfilled,
        (state, action: PayloadAction<PresetsState>) => {
          state.value = action.payload.value;
          state.activeIndexSwiper = action.payload.activeIndexSwiper;
          state.activePreset = action.payload.activePreset;
        }
      )
      .addCase(setNextPreset.rejected, (state, action) => {
        console.log(action);
      })
      .addCase(savePreset.rejected, (state, action) => {
        console.log('save error', action);
      });
  }
});

export const { setActivePreset, updatePresetSetting, setPresetState } =
  presetSlice.actions;
export default presetSlice.reducer;
