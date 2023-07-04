// import { ThunkDispatch } from '@reduxjs/toolkit';
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

import { ActionType, ISensorData } from '../../types/index';
import { setGesture } from './features/gestures/gestures-slice';
import { useAppDispatch, useAppSelector } from './hooks';
import { setStats } from './features/stats/stats-slice';
import { generateSimplePayload } from '../../utils/preheat';
import { addPresetFromDashboard } from './features/preset/preset-slice';
import { ScreenType } from './features/screens/screens-slice';
import { LCD_EVENTS, LCD_ACTIONS } from '../../../src/constants';

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
  return;
};

export const SetSocketKeyboardListeners = () => {
  const dispatch = useAppDispatch();
  const { presets, screen, settings } = useAppSelector((state) => state);

  useEffect(() => {
    const lister = (e: KeyboardEvent) => {
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

          const preset = {
            name: presets.activePreset.name,
            settings: (presets.activePreset?.settings || []).filter(
              (item) => item.id !== -1 && item.id !== -2
            )
          };

          const payload = generateSimplePayload({
            presset: preset as any,
            action: 'to_play'
          });

          socket.emit(LCD_EVENTS.ITALIAN_EVENT, payload);

          console.log(LCD_EVENTS.ITALIAN_EVENT, payload);

          // We not need send this event
          // socket.emit(LCD_EVENTS.ACTION_EVENT, LCD_ACTIONS.START_VALUE);

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
  }, [presets, screen, settings]);

  return dispatch;
};
