import { configureStore } from '@reduxjs/toolkit';
import gestureReducer from './features/gestures/gestures-slice';
import screenReducer from './features/screens/screenSlice';

export const store = configureStore({
  reducer: {
    gesture: gestureReducer,
    screen: screenReducer
  }
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
