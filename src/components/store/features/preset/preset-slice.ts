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
    },
    nextPreset: (state: PresetsState) => {
      if (state.activePresetIndex < state.value.length - 1) {
        const newActivePresetIndex = state.activePresetIndex + 1;
        state.activePresetIndex = newActivePresetIndex;
        if (newActivePresetIndex < state.value.length) {
          state.activePreset = state.value[newActivePresetIndex];
        }
      }
    },
    prevPreset: (state: PresetsState) => {
      if (state.activePresetIndex > 0) {
        const newActivePresetIndex = state.activePresetIndex - 1;
        state.activePresetIndex = newActivePresetIndex;
        state.activePreset = state.value[newActivePresetIndex];
      }
    },
    setPresets: (state: PresetsState, action: PayloadAction<IPreset[]>) => {
      state.value = action.payload;
      if (action.payload[0]) {
        state.activePreset = action.payload[0];
      }
    },
    addNewPreset: (state: PresetsState) => {
      state.value.push({
        id: state.value.length + 1,
        name: 'New Preset',
        sensors: {
          t: '0',
          p: '0',
          w: '0',
          f: '0'
        },
        time: ''
      });
      state.activePresetIndex = state.value.length - 1;
      state.activePreset = state.value[state.activePresetIndex];
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
      });
  }
});

export const {
  setActivePreset,
  nextPreset,
  prevPreset,
  setPresets,
  addNewPreset
} = presetSlice.actions;
export default presetSlice.reducer;
