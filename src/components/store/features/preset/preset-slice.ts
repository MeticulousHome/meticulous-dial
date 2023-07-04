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
import { getPresets } from '../extraReducer';

export interface PresetSettingInterface {
  activeSetting: number;
  startIndex: number;
  endIndex: number;
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
  initAt: number;
}

// export const deletePreset = createAsyncThunk(
//   'presetData/deletePreset',
//   async (presetId: number, { getState }) => {
//     const state = getState() as RootState;
//     const presets = [...state.presets.value];
//     let newSwiperIndex = state.presets.activeIndexSwiper;
//     let newDefaultPreset = { ...state.presets.activePreset };

//     let newListPresets: IPreset[] = presets.filter(
//       (preset) => preset.id !== presetId
//     );

//     if (newListPresets.length < presets.length) {
//       newDefaultPreset =
//         newListPresets.length > 0
//           ? newListPresets[0]
//           : { id: -1, name: 'Default', isDefault: false };
//       newSwiperIndex = 0;
//       newListPresets = newListPresets.map((preset) => ({
//         ...preset,
//         isDefault: preset.id === newDefaultPreset.id
//       }));
//     }

//     return { newListPresets, newSwiperIndex, newDefaultPreset };
//   }
// );

// export const setNextPreset = createAsyncThunk(
//   'presetData/setNextPreset',
//   async (_, { getState }) => {
//     const state = getState() as RootState;
//     const presetState = { ...state.presets } as PresetsState;
//     const index =
//       presetState.activeIndexSwiper > -1
//         ? presetState.activeIndexSwiper
//         : presetState.defaultPresetIndex;

//     if (presetState.activeIndexSwiper < presetState.value.length) {
//       presetState.activeIndexSwiper += 1;
//     }

//     if (index === presetState.value.length - 1) return presetState;

//     if (index < presetState.value.length - 1) {
//       const newActivePresetIndex = index + 1;

//       const presetList = [...presetState.value].map((i) => {
//         return {
//           ...i,
//           isDefault: false
//         };
//       });

//       presetList[newActivePresetIndex] = {
//         ...presetList[newActivePresetIndex],
//         isDefault: true
//       };
//       presetState.activePreset = presetList[newActivePresetIndex];
//     }
//     return presetState;
//   }
// );

// export const setPrevPreset = createAsyncThunk(
//   'presetData/setPrevPreset',
//   async (_, { getState }) => {
//     const state = getState() as RootState;
//     const presetState = { ...state.presets } as PresetsState;

//     const index =
//       presetState.activeIndexSwiper > -1
//         ? presetState.activeIndexSwiper
//         : presetState.defaultPresetIndex;

//     if (presetState.activeIndexSwiper > 0) {
//       presetState.activeIndexSwiper += -1;
//     }

//     if (presetState.activeIndexSwiper === presetState.value.length - 1)
//       return presetState;

//     if (index > 0) {
//       const newActivePresetIndex = index - 1;

//       const presetList = [...presetState.value].map((i) => {
//         return {
//           ...i,
//           isDefault: false
//         };
//       });

//       presetList[newActivePresetIndex] = {
//         ...presetList[newActivePresetIndex],
//         isDefault: true
//       };
//       presetState.activePreset = presetList[newActivePresetIndex];
//       // await setPresetsData(presetList);
//     } else {
//       // throw new Error('No more presets');
//     }
//     return presetState;
//   }
// );

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

    // await setPresetsData(presetList);

    const settings = getSettingsFromDashboardPayload(payload);

    const allSettings: IPresetsSettingData[] = [
      ...state.presets.allSettings,
      {
        presetId: presetId.toString(),
        settings
      }
    ];

    dispatch(
      setDefaultSettingsNewPreset({
        presetId: presetId.toString(),
        settingsDefault: settings
      })
    );

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

    // await setPresetsData(presetList);

    // const allSettings: IPresetsSettingData[] = [
    //   ...state.presets.allSettings,
    //   {
    //     presetId: presetId.toString(),
    //     settings: settingsDefaultNewPreset
    //   }
    // ];

    dispatch(
      setDefaultSettingsNewPreset({
        presetId: presetId.toString(),
        settingsDefault: settingsDefaultNewPreset
      })
    );

    return presetState;
  }
);

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
  endIndex: 0,

  updatingSettings: {
    presetId: '-1',
    settings: []
  },
  allSettings: [],
  pending: false,
  error: false,
  initAt: 0
};

const presetSlice = createSlice({
  name: 'presets',
  initialState,
  reducers: {
    setActivePreset: (state: PresetsState, action: PayloadAction<number>) => {
      // state.activePresetIndex = action.payload;
    },
    setPresets: (state: PresetsState, action: PayloadAction<IPreset[]>) => {
      state.value = action.payload;
      if (action.payload[0]) {
        state.activePreset = action.payload[0];
      }
    },
    setNextPreset: (state) => {
      const currentActiveIndex =
        state.activeIndexSwiper > -1
          ? state.activeIndexSwiper
          : state.defaultPresetIndex;

      if (state.activeIndexSwiper < state.value.length) {
        state.activeIndexSwiper += 1;
      }
      if (currentActiveIndex === state.value.length - 1) return;

      if (currentActiveIndex < state.value.length - 1) {
        const newActivePresetIndex = currentActiveIndex + 1;

        const presetList = [...state.value].map((i) => {
          return {
            ...i,
            isDefault: false
          };
        });

        presetList[newActivePresetIndex] = {
          ...presetList[newActivePresetIndex],
          isDefault: true
        };
        state.activePreset = presetList[newActivePresetIndex];
        state.initAt = Date.now();
        state.value = presetList;
        state.updatingSettings = {
          presetId: presetList[newActivePresetIndex].id.toString(),
          settings: presetList[newActivePresetIndex].settings
        };
      }
    },
    setPrevPreset: (state) => {
      const currentActiveIndex =
        state.activeIndexSwiper > -1
          ? state.activeIndexSwiper
          : state.defaultPresetIndex;
      if (state.activeIndexSwiper > 0) {
        state.activeIndexSwiper += -1;
      }
      if (state.activeIndexSwiper === state.value.length - 1) return;
      if (currentActiveIndex > 0) {
        const newActivePresetIndex = currentActiveIndex - 1;
        const presetList = [...state.value].map((i) => {
          return {
            ...i,
            isDefault: false
          };
        });
        presetList[newActivePresetIndex] = {
          ...presetList[newActivePresetIndex],
          isDefault: true
        };
        state.activePreset = presetList[newActivePresetIndex];
        state.initAt = Date.now();
        state.value = presetList;
        state.updatingSettings = {
          presetId: presetList[newActivePresetIndex].id.toString(),
          settings: presetList[newActivePresetIndex].settings
        };
        // await setPresetsData(presetList);
      } else {
        // throw new Error('No more presets');
      }
    },
    deletePreset: (state) => {
      const presets = [...state.value];
      let newSwiperIndex = state.activeIndexSwiper;
      let newDefaultPreset = { ...state.activePreset };

      let newListPresets: IPreset[] = presets.filter(
        (preset) => preset.id !== state.activePreset.id
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
      state.value = newListPresets;
      state.initAt = Date.now();
      state.activeIndexSwiper = newSwiperIndex;
      state.activePreset = newDefaultPreset;
    },
    setActiveIndexSwiper: (
      state: PresetsState,
      action: PayloadAction<number>
    ) => {
      if (action.payload > 0 && action.payload <= state.value.length) {
        state.activeIndexSwiper = action.payload;
      }
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
    setNextSettingOption: (state: Draft<typeof initialState>) => {
      const nextActiveSetting = state.activeSetting + 1;
      if (nextActiveSetting > state.endIndex) {
        return;
      }
      state.activeSetting = nextActiveSetting;
      return state;
    },
    setPrevSettingOption: (state: Draft<typeof initialState>) => {
      const nextActiveSetting = state.activeSetting - 1;
      if (nextActiveSetting < state.startIndex) {
        return;
      }
      state.activeSetting = nextActiveSetting;
      return state;
    },
    setSettings(
      state: Draft<typeof initialState>,
      action: PayloadAction<number>
    ) {
      // const targetSetting = state.activePreset;
      // const settings = [...targetSetting.settings];
      // state.updatingSettings = { ...targetSetting, settings };
      // state.endIndex = settings.length + DEFAULT_SETTING.length - 1;
      // return state;
    },
    discardSettings(state: Draft<typeof initialState>) {
      state.updatingSettings = {
        presetId: state.activePreset.id.toString(),
        settings: state.activePreset.settings || []
      };
      return state;
    },
    resetActiveSetting: (state: Draft<typeof initialState>) => {
      state.activeSetting = 0;
      return state;
    },
    setDefaultSettingsNewPreset: (
      state: Draft<typeof initialState>,
      action: PayloadAction<{
        presetId: string | null;
        settingsDefault: IPresetSetting[] | null;
      }>
    ) => {
      // state.activeSetting = 2;
      // const presetId = action.payload.presetId
      //   ? action.payload.presetId
      //   : (state.allSettings.length + 1).toString();
      // const settings = action.payload.settingsDefault
      //   ? action.payload.settingsDefault
      //   : settingsDefaultNewPreset;
      // state.settings = {
      //   presetId,
      //   settings
      // };
      // state.updatingSettings = {
      //   presetId,
      //   settings
      // };
      // state.endIndex = settings.length + DEFAULT_SETTING.length - 1;
      // state.allSettings = state.allSettings.concat(state.settings);
    },
    savePreset: (state: Draft<typeof initialState>) => {
      const updateSetting = state.updatingSettings;
      const activePreset = state.activePreset;
      activePreset.settings = [...updateSetting.settings];
      state.activePreset = { ...activePreset };

      const activeIndex = state.activeIndexSwiper;
      const copyListPresets = [...state.value];
      copyListPresets[activeIndex] = {
        ...copyListPresets[activeIndex],
        name: updateSetting.settings[0]?.value.toString(),
        settings: [...updateSetting.settings]
      };
      state.value = [...copyListPresets];
      state.initAt = Date.now();
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

            state.endIndex =
              (action.payload[defaultIndex].settings || []).length +
              DEFAULT_SETTING.length -
              1;
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
      // .addCase(savePresets.pending, (state) => {
      //   state.pending = true;
      // })
      // .addCase(
      //   savePresets.fulfilled,
      //   (state, action: PayloadAction<IPreset[]>) => {
      //     state.pending = false;
      //     state.value = action.payload;
      //     const index =
      //       state.activeIndexSwiper > -1
      //         ? state.activeIndexSwiper
      //         : state.defaultPresetIndex;
      //     state.activePreset = state.value[index];
      //   }
      // )
      // .addCase(savePresets.rejected, (state, action) => {
      //   state.pending = false;
      //   state.error = true;
      //   console.log(action.error);
      // })
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
          state.initAt = Date.now();
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
      );
    // .addCase(savePresetSetting.pending, (state: PresetSettingInterface) => {
    //   state.pending = true;
    //   state.error = false;
    // })
    // .addCase(
    //   savePresetSetting.fulfilled,
    //   (
    //     state: PresetSettingInterface,
    //     action: PayloadAction<{
    //       allSettings: IPresetsSettingData[];
    //       presetSettings: IPresetsSettingData;
    //     }>
    //   ) => {
    //     state.pending = false;
    //     state.error = false;
    //     // state.settings = action.payload;
    //     // state.endIndex = action.payload.length + 1;
    //     state.allSettings = action.payload.allSettings;
    //     state.settings = action.payload.presetSettings;
    //     state.updatingSettings = action.payload.presetSettings;
    //     // state.activeSetting = 2;
    //   }
    // )
    // .addCase(
    //   savePresetSetting.rejected,
    //   (state: PresetSettingInterface, action: any) => {
    //     state.pending = false;
    //     state.error = true;
    //     state.endIndex = 0;
    //     state.activeSetting = 0;
    //     console.log('savePresetSetting.rejected', action);
    //   }
    // );
  }
});

export const {
  setActivePreset,
  setActiveIndexSwiper,
  updatePresetSetting,
  setNextSettingOption,
  setSettings,
  setNextPreset,
  setPrevPreset,
  setPrevSettingOption,
  discardSettings,
  resetActiveSetting,
  setDefaultSettingsNewPreset,
  savePreset,
  deletePreset
} = presetSlice.actions;
export default presetSlice.reducer;
