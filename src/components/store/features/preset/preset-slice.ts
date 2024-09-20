import {
  createAsyncThunk,
  createSlice,
  Draft,
  PayloadAction
} from '@reduxjs/toolkit';
import { Profile } from '@meticulous-home/espresso-profile';
import equal from 'fast-deep-equal';

import { settingsDefaultNewPreset } from '../../../../utils/mock';
import { simpleJson } from '../../../../utils/preheat';
import {
  IPresetSetting,
  IPresetsSettingData,
  ProfileCause
} from '../../../../types/index';
import { RootState } from '../../store';
import {
  DEFAULT_SETTING,
  TEMPORARY_SETTINGS
} from '../../../../constants/setting';
import { setScreen } from '../screens/screens-slice';
import {
  saveProfile,
  getProfiles,
  deleteProfile,
  getLastProfile,
  getDefaultProfiles,
  getProfileDefaultImages
} from '../../../../api/profile';
import { addVariablesToSettings } from '../../../../utils/preset';

export interface PresetSettingInterface {
  activeSetting: number;
  startIndex: number;
  pending: boolean;
  error: boolean;
  updatingSettings: IPresetsSettingData;
  allSettings: IPresetsSettingData[];
}

export type ProfileValue = Profile & {
  // When adding something here make sure to also add to the deletion below
  settings: IPresetSetting[];
  isDefault?: boolean;
  isLast?: boolean;
  isTemporary?: boolean;
};

export function cleanupInternalProfile(profile: ProfileValue) {
  const copy = { ...profile };

  delete copy.settings;
  delete copy.isDefault;
  delete copy.isLast;
  delete copy.isTemporary;

  return copy;
}

export interface PresetsState extends PresetSettingInterface {
  value: Array<ProfileValue>;
  defaultProfilesInfo: {
    defaultProfiles: Array<Profile>;
    defaultProfileSelected?: Profile;
    defaultProfileActiveIndexSwiper: number;
    status: 'ready' | 'pending' | 'failed';
  };
  defaultPresetIndex: number;
  activeIndexSwiper: number;
  activePreset: ProfileValue;
  status: 'ready' | 'pending' | 'failed';
  option: 'HOME' | 'PRESSETS';
  profileHover: string;
  profileFocus: string;
}

export const loadDefaultProfiles = createAsyncThunk(
  'presetData/loadDefaultProfiles',
  async (_, { rejectWithValue }) => {
    let profiles = await getDefaultProfiles();

    if (profiles.length === 0) return rejectWithValue(null);

    const missingImage = profiles.some((profile) => !profile.display.image);

    if (missingImage) {
      const images = await getProfileDefaultImages();

      profiles = profiles.map((profile, index) => ({
        ...profile,
        display: {
          ...profile.display,
          image: profile.display.image ?? images[index]
        }
      }));
    }

    return profiles;
  }
);

export const addPresetNewOne = createAsyncThunk(
  'presetData/addNewOne',
  async ({ profile }: { profile: Profile }) => {
    const newProfileBody = profile
      ? profile
      : {
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
        settings: presetList[newActivePresetIndex].settings || []
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

    console.log('Delete preset: ', presetState.activePreset.id);

    await deleteProfile(presetState.activePreset.id.toString());

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
    const actionSettings = presetState.activePreset.isTemporary
      ? TEMPORARY_SETTINGS
      : DEFAULT_SETTING;
    const endIndex =
      presetState.activePreset.settings.filter(({ hidden }) => !hidden).length +
      (actionSettings.length - 1);

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
      (setting) => setting.key === 'name' && setting.isInternal
    );
    const temperatureSetting = updateSetting.settings.find(
      (setting) => setting.key === 'temperature' && setting.isInternal
    );
    const weight = updateSetting.settings.find(
      (setting) => setting.key === 'output' && setting.isInternal
    );

    const display = updateSetting.settings.find(
      (setting) => setting.key === 'image' && setting.isInternal
    );

    const profileSettings =
      updateSetting.settings.filter((setting) => !setting.isInternal) || [];

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

    const body = cleanupInternalProfile({
      ...presetState.activePreset,
      display: {
        ...presetState.activePreset.display,
        image: display
          ? `${display.value}`
          : presetState.activePreset.display.image
      },
      temperature: temperatureSetting.value as number,
      stages: presetState.activePreset.stages ?? simpleJson.stages,
      final_weight: weight.value as number,
      variables: profileSettings.map((p) => ({
        name: p.label,
        key: p.key,
        type: p.externalType,
        value: p.value as number
      }))
    });

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
  async (
    params: {
      cause?: ProfileCause;
      change_id?: string;
      profile_id?: string;
    },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as RootState;

    let defaultIndex =
      state.screen.value !== 'pressets' &&
      params.cause !== 'delete' &&
      params.cause !== 'create' &&
      params.cause !== 'load'
        ? state.presets.activeIndexSwiper
        : 0;

    const data = await getProfiles();
    if (data === undefined) {
      return rejectWithValue('Profile loading failed');
    }
    const lastProfile = await getLastProfile();
    const { cause, profile_id: profileId } = params;
    let isLastProfileKnown = false;
    let currentProfileWasModified = false;

    if (Array.isArray(data)) {
      if (profileId && cause) {
        currentProfileWasModified =
          state.presets.activePreset.id === profileId &&
          (cause === 'delete' || cause === 'update');
      }

      try {
        if (lastProfile?.profile?.id) {
          const lastProfilePotentialIndex = data.findIndex((p) => {
            let idToCompare = lastProfile.profile.id;
            if (profileId) idToCompare = profileId;
            return p.id === idToCompare;
          });

          if (lastProfilePotentialIndex >= 0) {
            isLastProfileKnown = equal(
              data[lastProfilePotentialIndex],
              lastProfile.profile
            );

            defaultIndex = lastProfilePotentialIndex;
          }
        } else {
          // There's no last profile
          const lastProfilePotentialIndex = data.findIndex(
            (profile) => profile.id === profileId
          );

          if (lastProfilePotentialIndex >= 0) {
            defaultIndex = lastProfilePotentialIndex;
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
      isLastProfileKnown,
      cause,
      currentProfileWasModified,
      profileId
    };
  }
);

const initialState: PresetsState = {
  value: [],
  // default profiles
  defaultProfilesInfo: {
    defaultProfileActiveIndexSwiper: 0,
    defaultProfiles: [],
    status: 'pending',
    defaultProfileSelected: null
  },
  // end default profiles
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
  status: 'pending',
  profileHover: '-1'
};

const presetSlice = createSlice({
  name: 'presets',
  initialState,
  reducers: {
    resetDefaultProfileConfig: (state) => {
      state.defaultProfilesInfo.defaultProfileActiveIndexSwiper = 0;
      state.defaultProfilesInfo.defaultProfileSelected = null;
    },
    setNextDefaultProfileOption: (state) => {
      state.defaultProfilesInfo.defaultProfileActiveIndexSwiper = Math.min(
        state.defaultProfilesInfo.defaultProfileActiveIndexSwiper + 1,
        state.defaultProfilesInfo.defaultProfiles.length
      );
    },
    setPrevDefaultProfileOption: (state) => {
      state.defaultProfilesInfo.defaultProfileActiveIndexSwiper = Math.max(
        state.defaultProfilesInfo.defaultProfileActiveIndexSwiper - 1,
        0
      );
    },
    setDefaultProfileSelected: (
      state: Draft<typeof initialState>,
      action: PayloadAction<Profile>
    ) => {
      state.defaultProfilesInfo.defaultProfileSelected = action.payload;
    },
    setPresetState: (_, action: PayloadAction<PresetsState>) => {
      return { ...action.payload };
    },
    setProfileHover: (
      state: Draft<typeof initialState>,
      action: PayloadAction<string>
    ) => {
      state.profileHover = action.payload;
    },
    setFocusProfile: (
      state: Draft<typeof initialState>,
      action: PayloadAction<string>
    ) => {
      state.profileFocus = action.payload;
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
        // FIXME show an error notification here
        if (!action.payload) return;

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
        state.status = 'pending';
      })
      .addCase(getPresets.fulfilled, (state, action) => {
        state.status = 'ready';

        if (!action.payload || !Array.isArray(action.payload.data)) {
          state.status = 'failed';
          return;
        }

        const payload: ProfileValue[] = action.payload.data.map(
          (preset: ProfileValue) => {
            return { settings: [], ...preset };
          }
        );
        const profileCount = payload.length;
        const { isLastProfileKnown } = action.payload;
        // const lastProfileData: ProfileValue = {
        //   settings: [],
        //   ...lastProfile?.profile
        // };

        const reloadCause = action.payload.cause;

        let defaultIndex = Number(action.payload.defaultIndex);
        if (isLastProfileKnown) {
          payload[defaultIndex].isLast = true;
        }
        // if (!isLastProfileKnown && lastProfile) {
        //   // FIXME: if a temporary profile should be shown should be a config option in the backend
        //   // This is currently causing sync/caching issues on real hardware while it works on desktop
        //   lastProfileData.isTemporary = true;
        //   lastProfileData.isLast = true;
        //   payload.push(lastProfileData);
        // }

        // A new profile was added
        if (reloadCause) {
          switch (reloadCause) {
            case 'create':
              defaultIndex = profileCount - 1;
              break;

            case 'delete': {
              // Does the last selected profile still exist? Follow it
              const lastSelectedProfileSpot = payload.findIndex(
                (profile) =>
                  profile.id === state.activePreset.id &&
                  state.activePreset.isTemporary === profile.isTemporary
              );

              // Another profile was deleted
              if (lastSelectedProfileSpot !== -1) {
                console.log(
                  `Profile ${state.activePreset.id} still exists in stop ${lastSelectedProfileSpot}`
                );
                defaultIndex = lastSelectedProfileSpot;
              } else {
                // The last selected profile was deleted, select the next one
                // Dont select the temporary profile untill absolutely necessary
                defaultIndex = Math.min(
                  profileCount > 0 ? profileCount - 1 : payload.length - 1,
                  state.activeIndexSwiper + 1
                );
              }
              break;
            }
            case 'load': {
              if (!isLastProfileKnown) {
                defaultIndex = payload.length - 1;
              }
              break;
            }
            default:
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
                  value: preset.name,
                  isInternal: true
                },
                {
                  id: 2,
                  type: 'numerical',
                  key: 'temperature',
                  label: 'temperature',
                  value: preset.temperature || 85,
                  unit: '°c',
                  isInternal: true
                },
                {
                  id: 3,
                  type: 'numerical',
                  key: 'output',
                  label: 'output',
                  value: preset.final_weight || 36,
                  unit: 'g',
                  isInternal: true
                },
                {
                  id: 4,
                  type: 'image',
                  key: 'image',
                  label: 'Select image',
                  value: preset.display.image.replace(
                    '/api/v1/profile/image/',
                    ''
                  ),
                  isInternal: true
                },
                // eslint-disable-next-line
                // @ts-ignore
                ...addVariablesToSettings({
                  variables: preset.variables,
                  nextId: 5
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
              presetId: payload[defaultIndex]?.id.toString(),
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
      .addCase(getPresets.rejected, (state, action) => {
        state.status = 'failed';
      })
      .addCase(setNextPreset.rejected, (state, action) => {
        console.log(action);
      })
      .addCase(savePreset.rejected, (state, action) => {
        console.log('save error', action);
      })
      .addCase(loadDefaultProfiles.pending, (state, action) => {
        state.defaultProfilesInfo.status = 'pending';
        state.pending = true;
      })
      .addCase(loadDefaultProfiles.fulfilled, (state, action) => {
        state.defaultProfilesInfo.status = 'ready';
        state.pending = false;
        state.defaultProfilesInfo.defaultProfiles = action.payload;
      })
      .addCase(loadDefaultProfiles.rejected, (state, action) => {
        state.defaultProfilesInfo.status = 'failed';
        state.pending = false;
        state.error = true;
      });
  }
});

export const {
  updatePresetSetting,
  setPresetState,
  setOptionPressets,
  setDefaultProfileSelected,
  setNextDefaultProfileOption,
  setPrevDefaultProfileOption,
  resetDefaultProfileConfig,
  setProfileHover,
  setFocusProfile
} = presetSlice.actions;
export default presetSlice.reducer;
