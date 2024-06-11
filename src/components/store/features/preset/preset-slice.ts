import {
  createAsyncThunk,
  createSlice,
  Draft,
  PayloadAction
} from '@reduxjs/toolkit';
import { Profile } from 'meticulous-typescript-profile';

import { settingsDefaultNewPreset } from '../../../../utils/mock';
import { simpleJson } from '../../../../utils/preheat';
import { IPresetSetting, IPresetsSettingData } from '../../../../types/index';
import { RootState } from '../../store';
import { DEFAULT_SETTING } from '../../../../constants/setting';
import { setScreen } from '../screens/screens-slice';
import {
  saveProfile,
  getProfiles,
  deleteProfile,
  getLastProfile
} from '../../../../api/profile';
import { addVariablesToSettings } from '../../../../utils/preset';
import equal from 'fast-deep-equal';

export interface PresetSettingInterface {
  activeSetting: number;
  startIndex: number;
  pending: boolean;
  error: boolean;
  updatingSettings: IPresetsSettingData;
  allSettings: IPresetsSettingData[];
}

export type ProfileValue = Profile & {
  settings: IPresetSetting[];
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

      const settings = payload.profile;
      presetList.push({
        id: '',
        name: payload?.profile?.name,
        isDefault: true,
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
  async () => {
    const newProfileBody = {
      ...simpleJson
    };

    return await saveProfile(newProfileBody);
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

    const pressureSettings =
      updateSetting.settings.filter((setting) =>
        setting.key.includes('pressure')
      ) || [];
    const flowSettings =
      updateSetting.settings.filter((setting) =>
        setting.key.includes('flow')
      ) || [];
    const timeSettings =
      updateSetting.settings.filter((setting) =>
        setting.key.includes('time')
      ) || [];
    const weightSettings =
      updateSetting.settings.filter((setting) =>
        setting.key.includes('weight')
      ) || [];

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
      stages: presetState.activePreset.stages ?? simpleJson.stages,
      final_weight: weight.value as number,
      variables: [
        ...pressureSettings.map((p) => ({
          name: p.label,
          key: p.key,
          type: 'pressure',
          value: p.value
        })),
        ...flowSettings.map((p) => ({
          name: p.label,
          key: p.key,
          type: 'flow',
          value: p.value
        })),
        ...timeSettings.map((p) => ({
          name: p.label,
          key: p.key,
          type: 'time',
          value: p.value
        })),
        ...weightSettings.map((p) => ({
          name: p.label,
          key: p.key,
          type: 'weight',
          value: p.value
        }))
      ]
    };
    await saveProfile(body);

    dispatch(
      setPresetState({
        ...presetState
      })
    );
  }
);

type ProfileCause = 'create' | 'update' | 'delete' | 'full_reload' | 'load';

export const getPresets = createAsyncThunk(
  'presetData/getData',
  async (cause: ProfileCause | null = null, { dispatch }) => {
    console.log('Fetching presets');
    let defaultIndex = 0;

    const data = await getProfiles();
    const lastProfile = await getLastProfile();
    var lastProfileKnown = false;

    if (Array.isArray(data)) {
      if (data.length === 0) dispatch(setScreen('pressets'));

      try {
        if (lastProfile?.profile?.id) {
          const lastProfilePotentialIndex = data.findIndex(
            (profile) => profile.id === lastProfile.profile.id
          );
          console.log('last profile id: ' + lastProfile?.profile?.id);
          if (lastProfilePotentialIndex >= 0) {
            lastProfileKnown = equal(
              data[lastProfilePotentialIndex],
              lastProfile.profile
            );
            if (lastProfileKnown) {
              defaultIndex = lastProfilePotentialIndex;
              console.log('the last profile is a known one');
            }
          }
        }
      } catch (e) {
        console.log(
          'Error getting last profile and comparing comparison: ' + e
        );
      }
    }

    return {
      data,
      defaultIndex,
      lastProfile,
      lastProfileKnown,
      cause
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
    //eslint-disable-next-line
    //@ts-ignore
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
      .addCase(addPresetNewOne.fulfilled, (state, action) => {
        state.value.push({
          // eslint-disable-next-line
          // @ts-ignore
          ...action.payload.profile,
          settings: settingsDefaultNewPreset
        });
        state.activeIndexSwiper = state.value.length - 1;
        state.activePreset = state.value[state.value.length - 1];
        state.defaultPresetIndex = state.value.length - 1;
        state.updatingSettings = {
          presetId: state.activePreset.id.toString(),
          settings: state.activePreset.settings
        };
      })
      .addCase(getPresets.pending, (state) => {
        state.pending = true;
      })
      .addCase(getPresets.fulfilled, (state, action) => {
        state.pending = false;

        const payload = action.payload.data as ProfileValue[];
        const lastProfile = action.payload.lastProfile;
        const lastProfileKnown = action.payload.lastProfileKnown;
        const reloadCause = action.payload.cause;

        // FIXME add the lastProfile to the profile rotation if it is NOT known,
        // else mark the last run profile with a tiny "last" which we can later replace with an icon

        if (!Array.isArray(payload)) {
          return;
        }

        let defaultIndex = Number(action.payload.defaultIndex);
        // A new profile was added
        if (reloadCause) {
          switch (reloadCause) {
            case 'create':
              defaultIndex = payload.length - 1;
              break;

            case 'delete':
              // Does the last selected profile still exist? Follow it
              const lastSelectedProfileSpot = payload.findIndex(
                (profile) => profile.id === state.activePreset.id
              );
              if (lastSelectedProfileSpot !== -1) {
                console.log(
                  'Profile ' +
                    state.activePreset.id +
                    ' still exists in stop ' +
                    lastSelectedProfileSpot
                );
                defaultIndex = lastSelectedProfileSpot;
              } else {
                // The last selected profile was deleted, select the next one
                defaultIndex = Math.min(
                  payload.length - 1,
                  state.activeIndexSwiper + 1
                );
              }
              break;

            case 'load':
              //FIXME handle unknown last profile here
              break;
          }
        }

        state.value = payload;

        if (state.value.length) {
          if (defaultIndex !== -1) {
            state.defaultPresetIndex = defaultIndex;
            state.allSettings = payload.map((preset) => {
              preset.settings = [
                {
                  id: 1,
                  type: 'text',
                  key: 'name',
                  label: 'name',
                  value: preset.name
                },
                {
                  id: 2,
                  type: 'numerical',
                  key: 'temperature',
                  label: 'temperature',
                  value: preset.temperature || 85,
                  unit: '°c'
                },
                {
                  id: 3,
                  type: 'numerical',
                  key: 'output',
                  label: 'output',
                  value: preset.final_weight || 36,
                  unit: 'g'
                },
                // eslint-disable-next-line
                // @ts-ignore
                ...addVariablesToSettings({
                  variables: preset.variables,
                  nextId: 4
                })
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
