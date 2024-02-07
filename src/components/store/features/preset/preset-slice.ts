import {
  createAsyncThunk,
  createSlice,
  Draft,
  PayloadAction
} from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { settingsDefaultNewPreset } from '../../../../utils/mock';

import {
  IPreset,
  IPresetSetting,
  IPresetsSettingData
} from '../../../../types/index';
import { RootState } from '../../store';
import { DEFAULT_SETTING } from '../../../../constants/setting';
import { setPresetsData } from '../../../../data/presets';
import { setScreen } from '../screens/screens-slice';
import { KIND_PROFILE } from '../../../../constants';
import Profile from '../../../../api/profile';

export interface PresetSettingInterface {
  activeSetting: number;
  startIndex: number;
  pending: boolean;
  error: boolean;
  updatingSettings: IPresetsSettingData;
  allSettings: IPresetsSettingData[];
}

export interface PresetsState extends PresetSettingInterface {
  value: IPreset[];
  defaultPresetIndex: number;
  activeIndexSwiper: number;
  activePreset: IPreset;
  pending: boolean;
  error: boolean;
  option: 'HOME' | 'PRESSETS';
}

export const addPresetFromDashboard = createAsyncThunk(
  'presetData/addPresetFromDashboard',
  async (payload: any, { getState, dispatch }) => {
    try {
      const state = getState() as RootState;
      const presetState = { ...state.presets } as PresetsState;

      const presetList = presetState.value.map((preset) => ({
        ...preset,
        isDefault: false
      }));

      const presetId = uuidv4();

      const settings = payload.profile;
      presetList.push({
        id: presetId,
        name: payload?.profile?.name,
        isDefault: true,
        kind: payload?.profile?.kind ?? KIND_PROFILE.DASHBOARD,
        settings: [
          {
            id: 1,
            type: 'text',
            key: 'name',
            label: 'name',
            value: payload?.profile?.name
          }
        ],
        dashboard: {
          ...settings
        }
      } as any);

      presetState.value = presetList;
      presetState.activeIndexSwiper = presetState.value.length - 1;
      presetState.activePreset =
        presetState.value[presetState.activeIndexSwiper];
      presetState.updatingSettings = {
        presetId: presetState.activePreset.id.toString(),
        settings: presetState.activePreset.settings
      };

      await setPresetsData(presetList);

      dispatch(
        setPresetState({
          ...presetState
        })
      );
    } catch (e) {
      console.log('ERROR:> ', e);
    }
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

    const presetId = uuidv4();

    presetList.push({
      id: presetId,
      name: 'New Preset',
      isDefault: true,
      settings: settingsDefaultNewPreset,
      kind: KIND_PROFILE.ITALIAN
    });
    presetState.value = presetList;
    presetState.activeIndexSwiper = presetState.value.length - 1;
    presetState.activePreset = presetState.value[presetState.activeIndexSwiper];

    presetState.updatingSettings = {
      presetId: presetState.activePreset.id.toString(),
      settings: presetState.activePreset.settings
    };

    await setPresetsData(presetList);

    dispatch(
      setPresetState({
        ...presetState
      })
    );
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

    presetState.updatingSettings = {
      presetId: presetState.activePreset.id.toString(),
      settings: presetState.activePreset.settings
    };

    dispatch(
      setPresetState({
        ...presetState
      })
    );

    dispatch(setScreen('pressets'));
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
    const nameSetting = updateSetting.settings.find(
      (setting) => setting.key === 'name'
    );
    const activePreset = {
      ...presetState.activePreset,
      settings: [...updateSetting.settings],
      name: nameSetting.value as string
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
    await Profile.save(presetState.activePreset);

    dispatch(
      setPresetState({
        ...presetState
      })
    );
  }
);

export const getPresets = createAsyncThunk(
  'presetData/getData',
  async (_, { dispatch }) => {
    const { data } = await Profile.getAll();

    if (data.length === 0) {
      dispatch(setScreen('pressets'));
    }

    return data;
  }
);

const initialState: PresetsState = {
  value: [],
  option: 'HOME',
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
  pending: true,
  error: false
};

const presetSlice = createSlice({
  name: 'presets',
  initialState,
  reducers: {
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
    },
    setOptionPressets: (
      state: Draft<typeof initialState>,
      action: PayloadAction<'HOME' | 'PRESSETS'>
    ) => {
      state.option = action.payload;
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
            (preset: IPreset) => preset.isDefault
          );
          if (defaultIndex !== -1) {
            state.defaultPresetIndex = defaultIndex;
            state.allSettings = action.payload.map((preset: IPreset) => ({
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
      .addCase(setNextPreset.rejected, (state, action) => {
        console.log(action);
      })
      .addCase(savePreset.rejected, (state, action) => {
        console.log('save error', action);
      });
  }
});

export const { updatePresetSetting, setPresetState, setOptionPressets } =
  presetSlice.actions;
export default presetSlice.reducer;
