import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

import { GestureType, ISensorData, ProfileCause } from '../../types/index';
import { useAppDispatch } from './hooks';
import { setStats, setWaterStatus } from './features/stats/stats-slice';
import { setScreen } from './features/screens/screens-slice';
import { getPresets } from './features/preset/preset-slice';
import { handleEvents } from '../../HandleEvents';
import {
  addOneNotification,
  NotificationItem,
  removeOneNotification
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

      if (!oNotification.message) {
        dispatch(removeOneNotification(oNotification.id));
      } else {
        dispatch(addOneNotification(oNotification));
      }
    });

    socket.on('status', (data: ISensorData) => {
      dispatch(setStats(data));

      // When stat is not in idle, lock the screen at Barometer
      if (data?.name !== 'idle') {
        dispatch(setScreen('barometer'));
      }
    });

    socket.on('water_status', (data: boolean) => {
      dispatch(setWaterStatus(data));
    });

    socket.on(
      'profile',
      (data: {
        change: ProfileCause;
        change_id: string;
        profile_id: string;
      }) => {
        console.log(`Profile ${data.change} - id: ${data.profile_id}`);
        dispatch(getPresets({ cause: data.change }));
      }
    );

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
        ENCODER_PRESSED: 'pressDown',
        ENCODER_RELEASED: 'pressUp'
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

const keyDownGestureMap: Record<string, GestureType> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Space: 'pressDown',
  Enter: 'context',
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
  useEffect(() => {
    const keyDownListener = (e: KeyboardEvent) => {
      const gesture = keyDownGestureMap[e.code];
      if (gesture) {
        console.log(gesture);
        handleEvents.emit('gesture', gesture);
      }
    };

    const keyUpListener = (e: KeyboardEvent) => {
      const gesture = keyUpGestureMap[e.code];
      gesture?.forEach((gesture) => {
        console.log(gesture);
        handleEvents.emit('gesture', gesture);
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
