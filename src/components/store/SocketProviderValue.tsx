import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

import { GestureType, ISensorData } from '../../types/index';
import { useAppDispatch, useAppSelector } from './hooks';
import { setStats } from './features/stats/stats-slice';
import { setScreen } from './features/screens/screens-slice';
import { addPresetFromDashboard } from './features/preset/preset-slice';
import { ScreenType } from './features/screens/screens-slice';
import { handleEvents } from '../../HandleEvents';

const socket: Socket | null = io('http://localhost:8080');

const NON_EDITING_SCREENS: ScreenType[] = ['barometer', 'pressets'];

export const SocketProviderValue = () => {
  const dispatch = useAppDispatch();
  const { stats, screen } = useAppSelector((state) => state);

  useEffect(() => {
    socket.on('status', (data: ISensorData) => {
      console.log('Listening: status', data.name);
      dispatch(setStats(data));

      // When stat is not in idle, lock the screen at Barometer
      if (data?.name !== 'idle') {
        dispatch(setScreen('barometer'));
      }
    });

    socket.on('save_profile', (data: any) => {
      console.log('Receive: save_profile');

      const shouldSetActiveScreen =
        NON_EDITING_SCREENS.includes(screen.value) && stats.name === 'idle';
      dispatch(
        addPresetFromDashboard({
          profile: JSON.parse(data),
          shouldSetActiveScreen
        })
      );
    });
  }, []);

  return socket;
};

const keyGestureMap: Record<string, GestureType> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Space: 'click',
  Enter: 'start',
  KeyS: 'longTare',
  KeyE: 'longEncoder',
  KeyD: 'doubleTare',
  KeyX: 'doubleClick'
};

export const useSocketKeyboardListeners = () => {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const gesture = keyGestureMap[e.code];
      if (gesture) {
        console.log(gesture);
        handleEvents.emit('gesture', gesture);
      }
    };

    window.addEventListener('keydown', listener);

    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, []);
};
