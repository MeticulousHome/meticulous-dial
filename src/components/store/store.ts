import { configureStore } from '@reduxjs/toolkit';
import { useSelector, TypedUseSelectorHook } from 'react-redux';

import screenReducer from './features/screens/screens-slice';
import statsReducer from './features/stats/stats-slice';
import presetReducer from './features/preset/preset-slice';

export const store = configureStore({
  reducer: {
    screen: screenReducer,
    stats: statsReducer,
    presets: presetReducer
  }
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export const useReduxSelector: TypedUseSelectorHook<RootState> = useSelector;
