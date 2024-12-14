import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

import { GestureType, ISensorData, ProfileCause } from '../../types/index';
import { useAppDispatch, useAppSelector } from './hooks';
import { setStats, setWaterStatus } from './features/stats/stats-slice';
import { setScreen } from './features/screens/screens-slice';
import {
  getPresets,
  setFocusProfile,
  setProfileHover
} from './features/preset/preset-slice';
import { handleEvents } from '../../HandleEvents';
import {
  addOneNotification,
  NotificationItem,
  removeOneNotification
} from './features/notifications/notification-slice';
import { api } from '../../api/api';
import { useQueryClient } from '@tanstack/react-query';
import { OS_UPDATE_STATUS } from '../../hooks/useOSStatus';
import { OSStatusResponse } from '@meticulous-home/espresso-api';
import { updatePreheatTimeLeft } from './features/settings/settings-slice';
import { useIdleTimer } from '../../hooks/useIdleTimer';

const SERVER_URL: string = window.env.SERVER_URL ?? 'http://localhost:8080';
const socket: Socket | null = io(SERVER_URL);

export const SocketProviderValue = () => {
  const dispatch = useAppDispatch();
  const currentStateName = useAppSelector((state) => state.stats.name);
  const queryClient = useQueryClient();
  const { resetTimer: resetIdleTimer } = useIdleTimer();

  // For development purpose
  useSocketKeyboardListeners();

  useEffect(() => {
    socket.on('notification', (notification: string) => {
      resetIdleTimer();
      const oNotification: NotificationItem = JSON.parse(notification);

      if (!oNotification.message && !oNotification.image) {
        dispatch(removeOneNotification(oNotification.id));
      } else {
        dispatch(addOneNotification(oNotification));
      }
    });

    socket.on('heater_status', (timeLeft: number) => {
      dispatch(updatePreheatTimeLeft(timeLeft));
    });

    socket.on('status', (data: ISensorData) => {
      dispatch(setStats(data));
      // When stat is not in idle, lock the screen at Barometer

      if (currentStateName !== data?.name) {
        if (data?.name === 'purge' || data?.name === 'home') {
          dispatch(setScreen('manual-purge'));
          return;
        }
        if (data?.name === 'heating') {
          dispatch(setScreen('heating'));
          return;
        }

        if (data?.name !== 'idle') {
          dispatch(setScreen('barometer'));
        }
      }
    });

    socket.on('water_status', (data: boolean) => {
      resetIdleTimer();
      dispatch(setWaterStatus(data));
    });

    socket.on(
      'profile',
      (data: {
        change: ProfileCause;
        change_id: string;
        profile_id: string;
      }) => {
        dispatch(getPresets({ ...data, cause: data.change }));
      }
    );

    socket.on(
      'button',
      (data: { type: string; time_since_last_event: number }) => {
        resetIdleTimer();

        console.log('Receive: button', data);

        const eventGestureMap: Record<string, GestureType> = {
          ENCODER_CLOCKWISE: 'right',
          ENCODER_COUNTERCLOCKWISE: 'left',
          ENCODER_PUSH: 'click',
          ENCODER_DOUBLE: 'doubleClick',
          ENCODER_LONG: 'longEncoder',
          TARE: 'singleTare',
          TARE_DOUBLE: 'doubleTare',
          TARE_LONG: 'longTare',
          CONTEXT: 'context',
          ENCODER_PRESSED: 'pressDown',
          ENCODER_RELEASED: 'pressUp'
        };

        const gesture = eventGestureMap[data.type];
        if (gesture) {
          console.log('gesture:', gesture);
          handleEvents.emit('gesture', gesture, data.time_since_last_event);
        }
      }
    );

    socket.on(
      'profileHover',
      (data: { id: string; from: string; type: 'focus' | 'scroll' }) => {
        resetIdleTimer();

        if (data.from === 'dial') {
          return;
        }

        if (data.type === 'scroll') {
          dispatch(setProfileHover(data.id));
        }

        if (data.type === 'focus') {
          dispatch(setFocusProfile(data.id));
        }
      }
    );
  }, []);

  useEffect(() => {
    socket.on('OSUpdate', async (data: OSStatusResponse) => {
      queryClient.setQueriesData({ queryKey: [OS_UPDATE_STATUS] }, data);
    });
    return () => {
      socket.off('OSUpdate');
    };
  }, [queryClient]);

  return socket;
};

const keyDownGestureMap: Record<string, GestureType> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Space: 'pressDown',
  Enter: 'context',
  KeyT: 'singleTare',
  KeyS: 'longTare',
  KeyE: 'longEncoder',
  KeyD: 'doubleTare',
  KeyX: 'doubleClick',
  KeyB: 'pressDown',
  KeyN: 'pressUp'
};

const keyUpGestureMap: Record<string, GestureType[]> = {
  Space: ['pressUp', 'click']
};

export const useSocketKeyboardListeners = () => {
  const { resetTimer: resetIdleTimer } = useIdleTimer();

  useEffect(() => {
    const keyDownListener = (e: KeyboardEvent) => {
      resetIdleTimer();
      const gesture = keyDownGestureMap[e.code];
      if (gesture) {
        console.log(gesture);
        handleEvents.emit('gesture', gesture, 1000);
      }

      if (e.code === 'KeyQ') {
        const stop = async () => {
          await api.executeAction('stop');
        };

        stop();
      }
    };

    const keyUpListener = (e: KeyboardEvent) => {
      const gesture = keyUpGestureMap[e.code];
      gesture?.forEach((gesture) => {
        console.log(gesture);
        handleEvents.emit('gesture', gesture, 1000);
      });
    };

    window.addEventListener('keydown', keyDownListener);
    window.addEventListener('keyup', keyUpListener);

    return () => {
      window.removeEventListener('keydown', keyDownListener);
      window.addEventListener('keyup', keyUpListener);
    };
  }, []);
};
