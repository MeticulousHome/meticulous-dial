import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getPresetsData, setPresetsData } from '../../../../data/presets';
import { setPresetSettingsData } from '../../../../data/presetSettings';
import { settingsDefaultNewPreset } from '../../../../utils/mock';

import {
  IPreset,
  IPresetSetting,
  IPresetsSettingData
} from '../../../../types/index';
import { RootState } from '../../store';
import {
  PresetSettingInterface,
  setDefaultSettingsNewPreset
} from '../presetSetting/presetSetting-slice';
import { generateDefaultAction } from '../../../../utils/preset';

interface PresetsState {
  value: IPreset[];
  defaultPresetIndex: number;
  activeIndexSwiper: number;
  activePreset: IPreset;
  pending: boolean;
  error: boolean;
}

export const getPresets = createAsyncThunk('presetData/getData', async () => {
  const presetsData = await getPresetsData();

  return JSON.parse(presetsData) as IPreset[];
});

export const savePresets = createAsyncThunk(
  'presetData/saveData',
  async (presetSetting: IPresetsSettingData, { getState }) => {
    const state = getState() as RootState;

    const presetState = state.presets;
    const index = presetState.value.findIndex(
      (preset) => preset.id === Number(presetSetting.presetId)
    );
    const presetList = [...presetState.value];

    const nameSetting = presetSetting.settings.find(
      (setting) => setting.key === 'name'
    );

    if (nameSetting) {
      presetList[index] = {
        ...presetList[index],
        name: nameSetting.value as string
      };
    }
    await setPresetsData(presetList);

    return presetList;
  }
);

export const deletePreset = createAsyncThunk(
  'presetData/deletePreset',
  async (presetId: number, { getState }) => {
    const state = getState() as RootState;
    const presets = [...state.presets.value];
    const currentActive = state.presets.activeIndexSwiper;
    let newSwiperIndex = 0;
    let newActiveIndex = 0;
    if (currentActive === 0) {
      newSwiperIndex = 0;
      newActiveIndex = 1;
    } else if (currentActive === presets.length - 1) {
      newSwiperIndex = currentActive - 1;
      newActiveIndex = currentActive - 1;
    } else if (currentActive > 0 && currentActive < presets.length - 1) {
      newSwiperIndex = currentActive;
      newActiveIndex = currentActive + 1;
    }

    const newDefaultPreset = presets[newActiveIndex]?.id
      ? presets[newActiveIndex]
      : {
          id: -1,
          name: 'Default'
        };
    const newListPresets: IPreset[] = presets
      .filter((preset) => preset.id !== presetId)
      .map((preset) => ({
        ...preset,
        isDefault: preset.id === newDefaultPreset.id
      }));

    await setPresetsData(newListPresets);
    // console.log('data', {
    //   newListPresets,
    //   newSwiperIndex,
    //   newDefaultPreset,
    //   newActiveIndex,
    //   currentActive
    // });
    return { newListPresets, newSwiperIndex, newDefaultPreset };
  }
);

export const setNextPreset = createAsyncThunk(
  'presetData/setNextPreset',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;
    const index =
      presetState.activeIndexSwiper > -1
        ? presetState.activeIndexSwiper
        : presetState.defaultPresetIndex;

    if (presetState.activeIndexSwiper < presetState.value.length) {
      presetState.activeIndexSwiper += 1;
    }

    if (index === presetState.value.length - 1) return presetState;

    if (index < presetState.value.length - 1) {
      const newActivePresetIndex = index + 1;

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
      await setPresetsData(presetList);
    }
    return presetState;
  }
);

export const setPrevPreset = createAsyncThunk(
  'presetData/setPrevPreset',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;

    const index =
      presetState.activeIndexSwiper > -1
        ? presetState.activeIndexSwiper
        : presetState.defaultPresetIndex;

    if (presetState.activeIndexSwiper > 0) {
      presetState.activeIndexSwiper += -1;
    }

    if (presetState.activeIndexSwiper === presetState.value.length - 1)
      return presetState;

    if (index > 0) {
      const newActivePresetIndex = index - 1;

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
      await setPresetsData(presetList);
    } else {
      // throw new Error('No more presets');
    }
    return presetState;
  }
);

export const addPresetNewOne = createAsyncThunk(
  'presetData/addNewOne',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;
    const settingsState = { ...state.presetSetting } as PresetSettingInterface;

    const presetList = presetState.value.map((preset) => ({
      ...preset,
      isDefault: false
    }));

    const presetId = new Date().getTime();

    presetList.push({
      id: presetId,
      name: 'New Preset',
      isDefault: true
    });
    presetState.value = presetList;
    presetState.activeIndexSwiper = presetState.value.length - 1;
    presetState.activePreset = presetState.value[presetState.activeIndexSwiper];

    await setPresetsData(presetList);
    const newPresetActions = generateDefaultAction(
      settingsDefaultNewPreset.length
    );
    const allSettings: IPresetsSettingData[] = [
      ...settingsState.allSettings,
      {
        presetId: presetId.toString(),
        settings: settingsDefaultNewPreset
      }
    ];

    await setPresetSettingsData(allSettings);

    dispatch(
      setDefaultSettingsNewPreset({
        presetId: presetId.toString(),
        settingsDefault: [
          ...settingsDefaultNewPreset,
          ...newPresetActions.flat()
        ] as IPresetSetting[]
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
    setPresets: (state: PresetsState, action: PayloadAction<IPreset[]>) => {
      state.value = action.payload;
      if (action.payload[0]) {
        state.activePreset = action.payload[0];
      }
    },
    setActiveIndexSwiper: (
      state: PresetsState,
      action: PayloadAction<number>
    ) => {
      if (action.payload > 0 && action.payload <= state.value.length) {
        state.activeIndexSwiper = action.payload;
      }
    }

    // setPresets: (state: PresetsState, action: PayloadAction<IPreset[]>) => {
    //   state.value = action.payload;
    //   if (action.payload[0]) {
    //     state.activePreset = action.payload[0];
    //   }
    // }
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
            state.activePreset = action.payload[defaultIndex];
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
      .addCase(savePresets.pending, (state) => {
        state.pending = true;
      })
      .addCase(
        savePresets.fulfilled,
        (state, action: PayloadAction<IPreset[]>) => {
          state.pending = false;
          state.value = action.payload;
          const index =
            state.activeIndexSwiper > -1
              ? state.activeIndexSwiper
              : state.defaultPresetIndex;
          state.activePreset = state.value[index];
        }
      )
      .addCase(savePresets.rejected, (state, action) => {
        state.pending = false;
        state.error = true;
        console.log(action.error);
      })
      .addCase(setNextPreset.pending, (state) => {
        state.pending = true;
      })
      .addCase(
        setNextPreset.fulfilled,
        (state, action: PayloadAction<PresetsState>) => {
          state.pending = false;
          state.activePreset = action.payload.activePreset;
          state.activeIndexSwiper = action.payload.activeIndexSwiper;
        }
      )
      .addCase(setNextPreset.rejected, (state, action) => {
        state.pending = false;
        state.error = true;
        console.log(action.error);
      })
      .addCase(setPrevPreset.pending, (state) => {
        state.pending = true;
      })
      .addCase(
        setPrevPreset.fulfilled,
        (state, action: PayloadAction<PresetsState>) => {
          state.pending = false;
          state.activePreset = action.payload.activePreset;
          state.activeIndexSwiper = action.payload.activeIndexSwiper;
        }
      )
      .addCase(setPrevPreset.rejected, (state, action) => {
        state.pending = false;
        state.error = true;
        console.log(action.error);
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
      .addCase(deletePreset.pending, (state) => {
        state.pending = true;
      })
      .addCase(deletePreset.rejected, (state, action) => {
        state.pending = false;
        state.error = true;
        console.log(action.error);
      })
      .addCase(
        deletePreset.fulfilled,
        (
          state,
          action: PayloadAction<{
            newListPresets: IPreset[];
            newSwiperIndex: number;
            newDefaultPreset: IPreset;
          }>
        ) => {
          state.value = action.payload.newListPresets;
          state.activeIndexSwiper = action.payload.newSwiperIndex;
          state.activePreset = action.payload.newDefaultPreset;
        }
      );
  }
});

export const { setActivePreset, setActiveIndexSwiper } = presetSlice.actions;
export default presetSlice.reducer;
