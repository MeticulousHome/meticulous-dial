import { configureStore } from '@reduxjs/toolkit';
import { useSelector, TypedUseSelectorHook } from 'react-redux';

import gestureReducer from './features/gestures/gestures-slice';
import screenReducer from './features/screens/screens-slice';

export const store = configureStore({
  reducer: {
    gesture: gestureReducer,
    screen: screenReducer
  }
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export const useReduxSelector: TypedUseSelectorHook<RootState> = useSelector;
