import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getPresetsData, setPresetsData } from '../../../../data/presets';

import { IPreset, IPresetsSettingData } from '../../../../types/index';
import { RootState } from '../../store';

interface PresetsState {
  value: IPreset[];
  activePresetIndex: number;
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

    if (
      presetSetting.settings[2].value &&
      typeof presetSetting.settings[2].value === 'string'
    ) {
      presetList[index] = {
        ...presetList[index],
        name: presetSetting.settings[2].value
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
    const index = presetState.activePresetIndex;
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
    const index = presetState.activePresetIndex;
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
    }
    return presetState;
  }
);

const initialState: PresetsState = {
  value: [],
  activePresetIndex: -1,
  activePreset: {
    name: '',
    sensors: {
      f: '',
      p: '',
      t: '',
      w: ''
    },
    id: -1,
    time: '0'
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
            state.activePresetIndex = defaultIndex;
            state.activePreset = action.payload[defaultIndex];
            state.activePresetIndex = defaultIndex;
            console.log('default preset', state.activePresetIndex);
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
        }
      )
      .addCase(setPrevPreset.rejected, (state, action) => {
        state.pending = false;
        state.error = true;
        console.log(action.error);
      });
  }
});

export const { setActivePreset } = presetSlice.actions;
export default presetSlice.reducer;
