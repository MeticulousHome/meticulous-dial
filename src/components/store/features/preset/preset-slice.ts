import {
  createAsyncThunk,
  createSlice,
  Draft,
  PayloadAction
} from '@reduxjs/toolkit';
import { Profile } from '@meticulous-home/espresso-profile';

import { simpleJson } from '../../../../utils/preheat';
import { IPresetSetting, IPresetsSettingData } from '../../../../types/index';
import { RootState } from '../../store';
import {
  DEFAULT_SETTING,
  TEMPORARY_SETTINGS
} from '../../../../constants/setting';
import { setScreen } from '../screens/screens-slice';
import {
  saveProfile,
  deleteProfile,
  getDefaultProfiles,
  getProfileDefaultImages
} from '../../../../api/profile';

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
    defaultProfileSelected?: Profile;
    defaultProfileActiveIndexSwiper: number;
  };
  defaultPresetIndex: number;
  activeIndexSwiper: number;
  activePreset: ProfileValue;
  status: 'ready' | 'pending' | 'failed';
  option: 'HOME' | 'PRESSETS';
  profileHover: string;
  profileFocus: string;
  profileFocused: boolean;
}

export const loadDefaultProfiles = createAsyncThunk(
  'presetData/loadDefaultProfiles',
  async (_, { rejectWithValue }) => {
    const profiles = await getDefaultProfiles();
    if (!profiles || !profiles.default || profiles.default.length === 0)
      return rejectWithValue(null);

    const images = await getProfileDefaultImages();
    profiles.default = profiles.default.map((profile, index) => ({
      ...profile,
      display: {
        ...profile.display,
        image: profile.display.image ?? images[index % images.length]
      }
    }));

    profiles.community = profiles.community.map((profile, index) => ({
      ...profile,
      display: {
        ...profile.display,
        image:
          profile.display?.image ??
          images[(profiles.default.length + index) % images.length]
      }
    }));

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

    if (presetState.activeIndexSwiper > 0) {
      const newIndex = presetState.activeIndexSwiper - 1;

      const presetList = [...presetState.value].map((i) => ({
        ...i,
        isDefault: false
      }));

      presetList[newIndex] = {
        ...presetList[newIndex],
        isDefault: true
      };

      presetState.activePreset = presetList[newIndex];
      presetState.activeIndexSwiper = newIndex;
      presetState.updatingSettings = {
        presetId: presetList[newIndex].id.toString(),
        settings: presetList[newIndex].settings
      };
      presetState.value = presetList;

      dispatch(
        setPresetState({
          ...presetState
        })
      );
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

    if (presetState.activeIndexSwiper < presetState.value.length)
      presetState.activeIndexSwiper += 1;

    if (currentActiveIndex === presetState.value.length) return;

    if (currentActiveIndex < presetState.value.length - 1) {
      const newActivePresetIndex = currentActiveIndex + 1;

      // Actualizar lista de presets con el nuevo activo
      const presetList = presetState.value.map((preset, idx) => ({
        ...preset,
        isDefault: idx === newActivePresetIndex
      }));

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

    dispatch(setScreen('profileHome'));
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

const initialState: PresetsState = {
  value: [],
  // default profiles
  defaultProfilesInfo: {
    defaultProfileActiveIndexSwiper: 0,
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
    setDefaultProfileActiveIndex: (
      state: Draft<typeof initialState>,
      action: PayloadAction<number>
    ) => {
      state.defaultProfilesInfo.defaultProfileActiveIndexSwiper =
        action.payload;
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
  }
});

export const {
  updatePresetSetting,
  setPresetState,
  setOptionPressets,
  setDefaultProfileSelected,
  setDefaultProfileActiveIndex,
  setProfileHover,
  setFocusProfile
} = presetSlice.actions;
export default presetSlice.reducer;
