import {
  createAsyncThunk,
  createSlice,
  Draft,
  PayloadAction
} from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import { Profile } from 'meticulous-typescript-profile';
import { UUID } from 'meticulous-typescript-profile/dist/uuid';

import { settingsDefaultNewPreset } from '../../../../utils/mock';
import { simpleJson } from '../../../../utils/preheat';
import { IPresetSetting, IPresetsSettingData } from '../../../../types/index';
import { RootState } from '../../store';
import { DEFAULT_SETTING } from '../../../../constants/setting';
import { setScreen } from '../screens/screens-slice';
import { KIND_PROFILE } from '../../../../constants';
import {
  saveProfile,
  getProfiles,
  deleteProfile
} from '../../../../api/profile';
import { getProfileIndex, saveProfileIndex } from '../../../../data/presets';

export interface PresetSettingInterface {
  activeSetting: number;
  startIndex: number;
  pending: boolean;
  error: boolean;
  updatingSettings: IPresetsSettingData;
  allSettings: IPresetsSettingData[];
}

type ProfileValue = Profile & {
  settings: IPresetSetting[];
  kind?: string;
  isDefault?: boolean;
};

export interface PresetsState extends PresetSettingInterface {
  value: Array<ProfileValue>;
  defaultPresetIndex: number;
  activeIndexSwiper: number;
  activePreset: ProfileValue;
  pending: boolean;
  error: boolean;
  option: 'HOME' | 'PRESSETS';
}

export const addPresetFromDashboard = createAsyncThunk(
  'presetData/addPresetFromDashboard',
  async (payload: any, { getState, dispatch }) => {
    try {
      const state = getState() as RootState;
      const presetState = { ...state.presets };

      const presetList = presetState.value.map((preset) => ({
        ...preset,
        isDefault: false
      }));

      // eslint-disable-next-line
      //@ts-ignore
      const _UUID = new UUID(uuidv4().toString()).value;

      const settings = payload.profile;
      presetList.push({
        id: _UUID,
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

      const body = { ...presetState.activePreset };
      delete body.settings;
      delete body.isDefault;

      await saveProfile(body);

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
    const presetState = { ...state.presets };

    const presetList = presetState.value.map((preset) => ({
      ...preset,
      isDefault: false
    }));

    // eslint-disable-next-line
    // @ts-ignore
    const _UUID = new UUID(uuidv4().toString()).value;

    presetList.push({
      ...simpleJson,
      id: _UUID,
      isDefault: true,
      settings: settingsDefaultNewPreset,
      kind: KIND_PROFILE.ITALIAN
    });

    presetState.value = presetList;
    presetState.activeIndexSwiper = presetState.value.length - 1;
    await saveProfileIndex(presetState.activeIndexSwiper);

    presetState.activePreset = presetState.value[presetState.activeIndexSwiper];

    presetState.updatingSettings = {
      presetId: presetState.activePreset.id.toString(),
      settings: presetState.activePreset.settings
    };

    const body = { ...presetState.activePreset };

    body.settings = undefined;
    body.isDefault = undefined;

    await saveProfile(body);

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
    const presetState = { ...state.presets };
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
      // await saveProfileIndex(newActivePresetIndex);

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

      // await saveProfileIndex(newActivePresetIndex);

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
    const presetState = { ...state.presets };
    const presets = [...presetState.value];
    let newSwiperIndex = presetState.activeIndexSwiper;
    let newDefaultPreset = { ...presetState.activePreset };

    let newListPresets: ProfileValue[] = presets.filter(
      (preset) => preset.id !== presetState.activePreset.id
    );

    console.log('Delete preset: ', presetState.activePreset.id);

    if (newListPresets.length < presets.length) {
      newDefaultPreset =
        newListPresets.length > 0
          ? newListPresets[0]
          : {
              ...simpleJson,
              name: 'Default',
              isDefault: false,
              settings: []
            };
      newSwiperIndex = 0;
      newListPresets =
        newListPresets.length > 0 ? newListPresets : [newDefaultPreset];
      newListPresets = newListPresets.map((preset) => ({
        ...preset,
        isDefault: preset.id === newDefaultPreset.id
      }));
    }

    await deleteProfile(presetState.activePreset.id.toString());

    presetState.activeIndexSwiper = newSwiperIndex;
    presetState.activePreset = newDefaultPreset;
    presetState.activeSetting = 0;
    presetState.value = newListPresets;

    presetState.updatingSettings = {
      presetId: presetState.activePreset.id.toString(),
      settings: presetState.activePreset.settings ?? []
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
    const presetState = { ...state.presets };
    const updateSetting = presetState.updatingSettings;
    const nameSetting = updateSetting.settings.find(
      (setting) => setting.key === 'name'
    );
    const temperatureSetting = updateSetting.settings.find(
      (setting) => setting.key === 'temperature'
    );
    const pressureSetting = updateSetting.settings.find(
      (setting) => setting.key === 'pressure'
    );
    const weight = updateSetting.settings.find(
      (setting) => setting.key === 'output'
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

    const body = {
      ...presetState.activePreset,
      temperature: temperatureSetting.value as number,
      final_weight: weight.value as number,
      variables: [
        {
          name: 'Pressure',
          key: 'pressure_1',
          type: 'pressure',
          value: pressureSetting.value as number
        }
      ]
    };

    body.settings = undefined;
    body.isDefault = undefined;
    await saveProfile(body);

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
    let defaultIndex = (await getProfileIndex()) || 0;

    const data = await getProfiles();

    if (Array.isArray(data)) {
      if (data.length === 0) dispatch(setScreen('pressets'));
      if (Number(defaultIndex) > data.length - 1) {
        defaultIndex = data.length - 1;
        await saveProfileIndex(data.length - 1);
      }
    }

    return {
      data,
      defaultIndex
    };
  }
);

const initialState: PresetsState = {
  value: [],
  option: 'HOME',
  defaultPresetIndex: -1,
  activeIndexSwiper: 0,
  activePreset: {
    name: 'New Preset',
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
      console.log(action.payload, '__DEV');
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

        const payload = action.payload.data as ProfileValue[];

        if (!Array.isArray(payload)) {
          console.log('Error: Invalid payload');
          return;
        }

        state.value = payload;

        if (payload.length) {
          const defaultIndex = Number(action.payload.defaultIndex);

          if (defaultIndex !== -1) {
            state.defaultPresetIndex = defaultIndex;

            state.allSettings = payload.map((preset) => {
              preset.settings = [
                {
                  id: 1,
                  type: 'text',
                  key: 'name',
                  label: `name`,
                  value: preset.name
                },
                {
                  id: 2,
                  type: 'numerical',
                  key: 'pressure',
                  label: 'pressure',
                  value:
                    preset.variables.find(
                      (variable) => variable.key === 'pressure_1'
                    ).value || 8,
                  unit: 'bar'
                },
                {
                  id: 3,
                  type: 'numerical',
                  key: 'temperature',
                  label: 'temperature',
                  value: preset.temperature || 85,
                  unit: '°c'
                },
                {
                  id: 4,
                  type: 'on-off',
                  key: 'pre-infusion',
                  label: 'pre-infusion',
                  value: 'yes'
                },
                {
                  id: 5,
                  type: 'on-off',
                  key: 'pre-heat',
                  label: 'pre-heat',
                  value: 'yes'
                },
                {
                  id: 6,
                  type: 'numerical',
                  key: 'output',
                  label: 'output',
                  value: preset.final_weight || 36,
                  unit: 'g'
                },
                {
                  id: 7,
                  type: 'multiple-option',
                  key: 'purge',
                  label: 'purge',
                  value: 'automatic'
                }
              ];

              return {
                presetId: preset.id.toString(),
                settings: preset.settings
              };
            });

            state.activePreset = payload[defaultIndex];
            const { settings } = state.allSettings.find(
              (item) => item.presetId === payload[defaultIndex].id.toString()
            );
            state.updatingSettings = {
              presetId: payload[defaultIndex].id.toString(),
              settings: settings || [...settingsDefaultNewPreset]
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
