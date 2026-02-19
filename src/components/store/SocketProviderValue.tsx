import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import {
  GestureType,
  ISensorData,
  ISensorDataAndMachineState
} from '../../types/index';
import { useAppDispatch } from './hooks';
import {
  setSensors,
  setStats,
  setWaterStatus,
  updatePreheatTimeLeft
} from './features/stats/stats-slice';
import { setScreen } from './features/screens/screens-slice';

import { handleEvents } from '../../HandleEvents';
import {
  addOneNotification,
  removeOneNotification,
  setMotorHot,
  NotificationItem,
  processNotification
} from './features/notifications/notification-slice';
import { api, API_URL } from '../../api/api';
import { useQueryClient } from '@tanstack/react-query';
import { OS_UPDATE_STATUS } from '../../hooks/useDeviceOSStatus';
import { OSStatusResponse, ProfileUpdate } from '@meticulous-home/espresso-api';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { LASTS_PROFILE_QUERY_KEY } from '../../hooks/useProfiles';
import { useProfileContext } from '../../context/ProfileContext';
import { HIDDEN_STAGES } from '../../constants/setting';

const socket: Socket | null = io(API_URL);

const isBrewComplete = (state: string) => {
  return state === 'remove cup' || state === 'click to purge';
};

export const SocketProviderValue = () => {
  const dispatch = useAppDispatch();
  const previousStateName = useRef<string>('idle');
  const queryClient = useQueryClient();
  const { resetTimer: resetIdleTimer } = useIdleTimer();
  const { setProfileStarting, onProfileEvent, onProfileHover } =
    useProfileContext();
  // For development purpose
  useSocketKeyboardListeners();

  useEffect(() => {
    socket.on('notification', (notification: string) => {
      resetIdleTimer();

      const oNotification: NotificationItem = JSON.parse(notification);

      const { updatedNotification, isMotorHot } =
        processNotification(oNotification);

      if (isMotorHot !== null) dispatch(setMotorHot(isMotorHot));

      if (!updatedNotification.message && !updatedNotification.image) {
        dispatch(removeOneNotification(updatedNotification.id));
      } else {
        dispatch(addOneNotification(updatedNotification));
      }
    });

    socket.on('heater_status', (timeLeft: number) => {
      dispatch(updatePreheatTimeLeft(timeLeft));
    });

    socket.on('sensors', (data: ISensorData) => {
      dispatch(setSensors(data));
    });

    socket.on('status', (data: ISensorDataAndMachineState) => {
      const previousState = previousStateName.current;
      if (data) {
        previousStateName.current = data?.name;
      }
      dispatch(setStats(data));

      if (previousState !== data?.name) {
        // Every status change resets the idle timer
        resetIdleTimer();
        queryClient.invalidateQueries({ queryKey: [LASTS_PROFILE_QUERY_KEY] });
        setProfileStarting(false);

        if (data?.name === 'heating') {
          dispatch(setWaterStatus(true));
          dispatch(setScreen('heating'));
          return;
        }
        // FIXME: We desperately need to refactor the machines statemachine -_-'
        if (data?.name === 'Pour water and click to continue') {
          dispatch(setWaterStatus(false));
          dispatch(setScreen('heating'));
          return;
        }
        if (data?.name === 'click to start') {
          dispatch(setWaterStatus(true));
          dispatch(setScreen('heating'));
          return;
        }

        if (
          isBrewComplete(data?.name) ||
          (isBrewComplete(previousState) && data?.name === 'purge')
        ) {
          dispatch(setScreen('brewComplete'));
          return;
        }
        // Brew complete screen takes precedence here when purging
        if (data?.name === 'purge' || data?.name === 'home') {
          dispatch(setScreen('manual-purge'));
          return;
        }

        // We ignore the boot state but ensure the machine is in idle
        if (data?.name === 'boot' && data?.state === 'idle') {
          return;
        }

        // When the machine is not in a hidden stage, lock the screen at Barometer
        if (!HIDDEN_STAGES.includes(data?.name)) {
          dispatch(setScreen('barometer'));
        }
      }
    });

    socket.on('water_status', (data: boolean) => {
      resetIdleTimer();
      dispatch(setWaterStatus(data));
    });

    socket.on('profile', (event: ProfileUpdate) => {
      console.log('ProfileUpdate', event);
      onProfileEvent(event);
    });

    socket.on(
      'button',
      (data: { type: string; time_since_last_event: number }) => {
        const eventGestureMap: Record<string, GestureType> = {
          ENCODER_CLOCKWISE: 'right',
          ENCODER_COUNTERCLOCKWISE: 'left',
          ENCODER_PUSH: 'click',
          ENCODER_DOUBLE: 'doubleClick',
          ENCODER_LONG: 'longEncoder',
          TARE: 'singleTare',
          TARE_DOUBLE: 'doubleTare',
          TARE_LONG: 'longTare',
          TARE_PRESSED: 'tareDown',
          TARE_RELEASED: 'tareUp',
          CONTEXT: 'context',
          ENCODER_PRESSED: 'pressDown',
          ENCODER_RELEASED: 'pressUp'
        };

        const gesture = eventGestureMap[data.type];
        if (gesture) {
          if (
            gesture === 'right' ||
            gesture === 'left' ||
            gesture === 'pressDown' ||
            gesture === 'context' ||
            gesture === 'singleTare'
          ) {
            resetIdleTimer();
          }
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
        onProfileHover(data.type, data.id);
      }
    );

    return () => {
      socket.off('notification');
      socket.off('heater_status');
      socket.off('sensors');
      socket.off('status');
      socket.off('water_status');
      socket.off('profile');
      socket.off('button');
      socket.off('profileHover');
    };
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
  KeyZ: 'tareUp',
  KeyR: 'tareDown',
  KeyS: 'longTare',
  KeyE: 'longEncoder',
  KeyD: 'doubleTare',
  KeyX: 'doubleClick',
  KeyB: 'pressDown',
  KeyN: 'pressUp'
};

const keyUpGestureMap: Record<string, GestureType[]> = {
  Space: ['pressUp', 'click'],
  KeyT: ['singleTare']
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
      window.removeEventListener('keyup', keyUpListener);
    };
  }, []);
};
