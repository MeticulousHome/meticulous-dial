// import { ThunkDispatch } from '@reduxjs/toolkit';
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

import { ActionType, ISensorData } from '../../types/index';
import { setGesture } from './features/gestures/gestures-slice';
import { useAppDispatch, useAppSelector } from './hooks';
import { setStats } from './features/stats/stats-slice';
import { generatePayload } from '../../utils/preheat';
import { addPresetFromDashboard } from './features/preset/preset-slice';
import { ScreenType } from './features/screens/screens-slice';

interface SocketProviderValueInterface {
  sendAction: (name: ActionType) => void;
  sendPreset: (name: string) => void;
}

const socket: Socket | null = io('http://localhost:8080');

const NON_EDITING_SCREENS: ScreenType[] = ['barometer', 'pressets'];

export const SocketProviderValue = (): SocketProviderValueInterface => {
  const dispatch = useAppDispatch();
  const { stats, screen } = useAppSelector((state) => state);

  useEffect(() => {
    socket.on('status', (data: ISensorData) => {
      console.log('Listening: status', data.name);
      dispatch(setStats(data));
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

  // const sendAction = (name: ActionType) => {
  //   socket.emit("action", name.toLowerCase());
  // };

  // const sendPreset = (name: string) => {
  //   socket.emit("preset", name.toLowerCase());
  // };

  // return { sendAction, sendPreset };
  return;
};

export const SetSocketKeyboardListeners = () => {
  const dispatch = useAppDispatch();
  const { presets, presetSetting, screen, settings } = useAppSelector(
    (state) => state
  );

  useEffect(() => {
    const lister = (e: KeyboardEvent) => {
      const preset = {
        name: presets.activePreset.name,
        settings: presetSetting.settings.settings.filter(
          (item) => item.id !== -1 && item.id !== -2
        )
      };

      const payload = generatePayload({ presset: preset as any });
      console.log(e.code);
      switch (e.code) {
        case 'ArrowLeft':
          dispatch(setGesture('left'));
          break;
        case 'ArrowRight':
          dispatch(setGesture('right'));
          break;
        case 'Space':
          if (
            screen.value === 'settings' &&
            settings.settings[settings.activeIndexSetting]
          ) {
            switch (settings.settings[settings.activeIndexSetting].key) {
              case 'home':
                socket.emit('action', 'home');
                break;
              case 'purge':
                socket.emit('action', 'purge');
                break;
              case 'calibrate':
                socket.emit('calibrate');
                break;
              default:
                break;
            }
          }
          dispatch(setGesture('click'));
          break;
        case 'Enter': {
          if (screen.value !== 'barometer') return;

          console.log(JSON.stringify(payload, null, 2));

          socket.emit('parameters', payload);
          socket.emit('action', 'start');
          dispatch(setGesture('start'));
          break;
        }
        case 'KeyS':
          dispatch(setGesture('longTare'));
          break;
        case 'KeyE':
          dispatch(setGesture('longEncoder'));
          break;
        case 'KeyD':
          dispatch(setGesture('doubleTare'));
          break;
        case 'KeyX':
          dispatch(setGesture('doubleClick'));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', lister);

    return () => {
      window.removeEventListener('keydown', lister);
    };
  }, [presets, presetSetting, screen, settings]);

  return dispatch;
};
