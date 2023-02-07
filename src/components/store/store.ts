import { configureStore } from '@reduxjs/toolkit';
import { useSelector, TypedUseSelectorHook } from 'react-redux';

import gestureReducer from './features/gestures/gestures-slice';
import screenReducer from './features/screens/screens-slice';
import statsReducer from './features/stats/stats-slice';
import presetReducer from './features/preset/preset-slice';
import presetSettingReducer from './features/presetSetting/presetSetting-slice';

export const store = configureStore({
  reducer: {
    gesture: gestureReducer,
    screen: screenReducer,
    stats: statsReducer,
    presets: presetReducer,
    presetSetting: presetSettingReducer
  }
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export const useReduxSelector: TypedUseSelectorHook<RootState> = useSelector;
