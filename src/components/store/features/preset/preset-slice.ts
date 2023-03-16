import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { setPresetSettingsData } from '../../../../data/presetSettings';
import { settingsDefaultNewPreset } from '../../../../utils/mock';
import { getPresetsData, setPresetsData } from '../../../../data/presets';

import { IPreset, IPresetsSettingData } from '../../../../types/index';
import { RootState } from '../../store';
import {
  PresetSettingInterface,
  setDefaultSettingsNewPreset
} from '../presetSetting/presetSetting-slice';

interface PresetsState {
  value: IPreset[];
  activePresetIndex: number;
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

export const setNextPreset = createAsyncThunk(
  'presetData/setNextPreset',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const presetState = { ...state.presets } as PresetsState;
    const index =
      presetState.activePresetIndex > -1
        ? presetState.activePresetIndex
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
      presetState.activePresetIndex = newActivePresetIndex;
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
      presetState.activePresetIndex > -1
        ? presetState.activePresetIndex
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
      presetState.activePresetIndex = newActivePresetIndex;
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

    const presetId = presetState.value.length + 1;

    presetList.push({
      id: presetId,
      name: 'New Preset',
      isDefault: true
    });
    presetState.value = presetList;
    presetState.activePresetIndex = presetState.value.length - 1;
    presetState.activeIndexSwiper = presetState.value.length - 1;
    presetState.activePreset = presetState.value[presetState.activePresetIndex];

    await setPresetsData(presetList);

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
        settingsDefault: settingsDefaultNewPreset
      })
    );

    return presetState;
  }
);

const initialState: PresetsState = {
  value: [],
  activePresetIndex: -1,
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
      state.activePresetIndex = action.payload;
    },
    setPresets: (state: PresetsState, action: PayloadAction<IPreset[]>) => {
      state.value = action.payload;
      if (action.payload[0]) {
        state.activePreset = action.payload[0];
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
          state.activePresetIndex = action.payload.activePresetIndex;
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
          state.activePresetIndex = action.payload.activePresetIndex;
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
          state.activePresetIndex = action.payload.activePresetIndex;
          state.activeIndexSwiper = action.payload.activeIndexSwiper;
          state.activePreset = action.payload.activePreset;
        }
      );
  }
});

export const { setActivePreset } = presetSlice.actions;
export default presetSlice.reducer;
