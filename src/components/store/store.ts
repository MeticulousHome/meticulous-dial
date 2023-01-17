import { configureStore } from '@reduxjs/toolkit';
import gestureReducer from './features/gestures/gestures-slice';

export const store = configureStore({
  reducer: {
    gesture: gestureReducer
  }
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
