import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

import { GestureType, ISensorData } from '../../types/index';
import { useAppDispatch } from './hooks';
import { setStats } from './features/stats/stats-slice';
import { setScreen } from './features/screens/screens-slice';
import { addPresetFromDashboard } from './features/preset/preset-slice';
import { handleEvents } from '../../HandleEvents';
import {
  addOneNotification,
  NotificationItem
} from './features/notifications/notification-slice';

const SERVER_URL: string = process.env.SERVER_URL ?? 'http://localhost:8080';
const socket: Socket | null = io(SERVER_URL);

export const SocketProviderValue = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    socket.on('notification', (notification: string) => {
      const oNotification: NotificationItem = JSON.parse(notification);

      if (oNotification.responses.length === 0) {
        return;
      }

      dispatch(addOneNotification(oNotification));
    });

    socket.on('status', (data: ISensorData) => {
      dispatch(setStats(data));

      // When stat is not in idle, lock the screen at Barometer
      if (data?.name !== 'idle') {
        dispatch(setScreen('barometer'));
      }
    });

    socket.on('save_in_dial', (data: any) => {
      console.log('Receive: save_in_dial');

      dispatch(
        addPresetFromDashboard({
          profile: JSON.parse(data)
        })
      );
    });

    socket.on('button', (data: { type: string }) => {
      console.log('Receive: button', data);

      const eventGestureMap: Record<string, GestureType> = {
        ENCODER_CLOCKWISE: 'right',
        ENCODER_COUNTERCLOCKWISE: 'left',
        ENCODER_PUSH: 'click',
        ENCODER_DOUBLE: 'doubleClick',
        ENCODER_LONG: 'longEncoder',
        TARE_DOUBLE: 'doubleTare',
        TARE_LONG: 'longTare',
        CONTEXT: 'context',
        CANCEL: 'cancel'
      };

      const gesture = eventGestureMap[data.type];
      if (gesture) {
        console.log('gesture:', gesture);
        handleEvents.emit('gesture', gesture);
      }
    });
  }, []);

  return socket;
};

const keyGestureMap: Record<string, GestureType> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Space: 'click',
  Enter: 'context',
  KeyS: 'longTare',
  KeyE: 'longEncoder',
  KeyD: 'doubleTare',
  KeyX: 'doubleClick',
  KeyC: 'cancel'
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
