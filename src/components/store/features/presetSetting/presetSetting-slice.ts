// import {
//   createAsyncThunk,
//   createSlice,
//   Draft,
//   PayloadAction
// } from '@reduxjs/toolkit';

// import { setPresetSettingsData } from '../../../../data/presetSettings';
// import { IPresetSetting, IPresetsSettingData } from '../../../../types';
// import { settingsDefaultNewPreset } from '../../../../utils/mock';
// import { RootState } from '../../store';
// import { DEFAULT_SETTING } from '../../../../constants/setting';

// export interface PresetSettingInterface {
//   activeSetting: number;
//   startIndex: number;
//   endIndex: number;
//   pending: boolean;
//   error: boolean;
//   settings: IPresetsSettingData;
//   updatingSettings: IPresetsSettingData;
//   allSettings: IPresetsSettingData[];
// }
// const initialState: PresetSettingInterface = {
//   pending: false,
//   error: false,
//   activeSetting: 0,
//   startIndex: 0,
//   endIndex: 0,
//   settings: {
//     presetId: '-1',
//     settings: []
//   },
//   updatingSettings: {
//     presetId: '-1',
//     settings: []
//   },
//   allSettings: []
// };

// export const deletePresetSettings = createAsyncThunk(
//   'presetSetting/deletePresetSetting',
//   async (presetId: number, { getState }) => {
//     const state = getState() as RootState;
//     const presetSettings = [...state.presetSetting.allSettings];
//     const newListPresetSettings = presetSettings.filter(
//       (presetSetting) => Number(presetSetting.presetId) !== presetId
//     );

//     await setPresetSettingsData(newListPresetSettings);
//     return { newListPresetSettings };
//   }
// );

// const presetSettingSlice = createSlice({
//   name: 'presetSettings',
//   initialState: initialState,
//   reducers: {
//     setNextSettingOption: (state: Draft<typeof initialState>) => {
//       const nextActiveSetting = state.activeSetting + 1;
//       if (nextActiveSetting > state.endIndex) {
//         return;
//       }
//       state.activeSetting = nextActiveSetting;
//       return state;
//     },
//     setPrevSettingOption: (state: Draft<typeof initialState>) => {
//       const nextActiveSetting = state.activeSetting - 1;
//       if (nextActiveSetting < state.startIndex) {
//         return;
//       }
//       state.activeSetting = nextActiveSetting;
//       return state;
//     },
//     resetActiveSetting: (state: Draft<typeof initialState>) => {
//       state.activeSetting = 0;
//       return state;
//     },
//     setEndIndex: (
//       state: Draft<typeof initialState>,
//       action: PayloadAction<number>
//     ) => {
//       state.activeSetting = 2;
//       state.endIndex = action.payload;
//       return state;
//     },
//     setDefaultSettingsNewPreset: (
//       state: Draft<typeof initialState>,
//       action: PayloadAction<{
//         presetId: string | null;
//         settingsDefault: IPresetSetting[] | null;
//       }>
//     ) => {
//       state.activeSetting = 2;
//       const presetId = action.payload.presetId
//         ? action.payload.presetId
//         : (state.allSettings.length + 1).toString();
//       const settings = action.payload.settingsDefault
//         ? action.payload.settingsDefault
//         : settingsDefaultNewPreset;

//       state.settings = {
//         presetId,
//         settings
//       };
//       state.updatingSettings = {
//         presetId,
//         settings
//       };
//       state.endIndex = settings.length + DEFAULT_SETTING.length - 1;
//       state.allSettings = state.allSettings.concat(state.settings);
//     },
//     setSettings(
//       state: Draft<typeof initialState>,
//       action: PayloadAction<number>
//     ) {
//       const targetSetting = state.allSettings.find(
//         (setting) => setting.presetId === action.payload.toString()
//       );
//       const settings = [...targetSetting.settings];
//       const hiddenSettings = targetSetting.settings.filter(
//         (setting) => setting.hidden
//       );
//       state.settings = { ...targetSetting, settings };
//       state.updatingSettings = { ...targetSetting, settings };
//       state.endIndex =
//         settings.length + DEFAULT_SETTING.length - 1 - hiddenSettings.length;

//       return state;
//     },
//     discardSettings(state: Draft<typeof initialState>) {
//       state.updatingSettings = state.settings;
//       return state;
//     }
//   },
//   extraReducers: (builder) => {
//     builder
//       // .addCase(getPresetSettings.pending, (state: PresetSettingInterface) => {
//       //   state.pending = true;
//       //   state.error = false;
//       // })
//       // .addCase(
//       //   getPresetSettings.fulfilled,
//       //   (
//       //     state: PresetSettingInterface,
//       //     action: PayloadAction<IPresetsSettingData[]>
//       //   ) => {
//       //     state.pending = false;
//       //     state.error = false;
//       //     state.allSettings = action.payload.map((presetSetting) => ({
//       //       ...presetSetting,
//       //       settings: filterSettingAction(presetSetting.settings)
//       //     }));
//       //     // reset active setting
//       //     // state.activeSetting = 2;
//       //   }
//       // )
//       // .addCase(
//       //   getPresetSettings.rejected,
//       //   (state: PresetSettingInterface, action: any) => {
//       //     console.log('getPresetSettings.rejected', action);
//       //     state.pending = false;
//       //     state.error = true;
//       //     state.endIndex = 0;
//       //     state.activeSetting = 0;
//       //   }
//       // )
//       .addCase(
//         deletePresetSettings.pending,
//         (state: PresetSettingInterface) => {
//           state.pending = true;
//           state.error = false;
//         }
//       )
//       .addCase(
//         deletePresetSettings.rejected,
//         (state: PresetSettingInterface, action: any) => {
//           console.log('deletePresetSettings.rejected', action);
//           state.pending = false;
//           state.error = true;
//           state.endIndex = 0;
//           state.activeSetting = 0;
//         }
//       )
//       .addCase(
//         deletePresetSettings.fulfilled,
//         (
//           state: PresetSettingInterface,
//           // eslint-disable-next-line @typescript-eslint/no-unused-vars
//           _action: PayloadAction<{
//             newListPresetSettings: IPresetsSettingData[];
//           }>
//         ) => {
//           state.pending = false;
//           state.error = false;

//           // state.allSettings = action.payload.newListPresetSettings;
//           // state.settings = action.payload.newListPresetSettings[0];
//           // state.updatingSettings = action.payload.newListPresetSettings[0];
//           // state.endIndex =
//           //   action.payload.newListPresetSettings[0].settings.length - 1;
//           // // reset active setting
//           // state.activeSetting = 2;
//         }
//       );
//   }
// });

// // export const { setDefaultSettingsNewPreset } = presetSettingSlice.actions;

// export default presetSettingSlice.reducer;
// // setNextSettingOption,
// // resetActiveSetting,
// // setEndIndex,
// // setDefaultSettingsNewPreset,
// // setSettings,
// // discardSettings
